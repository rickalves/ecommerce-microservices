import { Controller } from '@nestjs/common';
import { Payload, EventPattern, Ctx, RmqContext } from '@nestjs/microservices';
import type { ConsumeMessage, Channel } from 'amqplib';
import { CreatePaymentDto } from '@ecommerce/shared';
import type { OrderCreatedAcceptedEvent, OrderCancelledEvent } from '@ecommerce/shared';
import { QUEUES, MAX_RETRIES } from '@ecommerce/shared';

import { ProcessPaymentUseCase } from '../../application/use-cases/process-payment.use-case';
import { GetPaymentUseCase } from '../../application/use-cases/get-payment.use-case';
import { RefundPaymentUseCase } from '../../application/use-cases/refund-payment.use-case';

/**
 * RabbitMQ Event Handler para Commands assíncronos do Payment Service.
 * Queries síncronas são tratadas pelo PaymentHttpController.
 *
 * Implementa ACK manual: confirma a mensagem após processamento bem-sucedido.
 * Em caso de falha, aplica retry via DLX (até MAX_RETRIES tentativas).
 * Após MAX_RETRIES, envia para a DLQ com pattern 'dlq.message'.
 */
@Controller()
export class PaymentController {
    constructor(
        private readonly processPaymentUseCase: ProcessPaymentUseCase,
        private readonly getPaymentUseCase: GetPaymentUseCase,
        private readonly refundPaymentUseCase: RefundPaymentUseCase
    ) {}

    @EventPattern('order.created.accepted')
    async handleOrderCreatedAccepted(
        @Payload() data: OrderCreatedAcceptedEvent,
        @Ctx() context: RmqContext
    ) {
        await this.processEvent(context, 'order.created.accepted', () => {
            const { order } = data;
            const createPaymentDto: CreatePaymentDto = {
                orderId: order.id,
                userId: order.userId,
                amount: order.totalAmount,
                method: 'CREDIT_CARD' as any,
            };
            return this.processPaymentUseCase.execute(createPaymentDto);
        });
    }

    @EventPattern('payment.create')
    async handlePaymentCreate(
        @Payload() createPaymentDto: CreatePaymentDto,
        @Ctx() context: RmqContext
    ) {
        await this.processEvent(context, 'payment.create', () =>
            this.processPaymentUseCase.execute(createPaymentDto)
        );
    }

    @EventPattern('payment.refund')
    async refundPayment(@Payload() paymentId: string, @Ctx() context: RmqContext) {
        await this.processEvent(context, 'payment.refund', () =>
            this.refundPaymentUseCase.execute(paymentId)
        );
    }

    @EventPattern('order.cancelled')
    async handleOrderCancelled(@Payload() data: OrderCancelledEvent, @Ctx() context: RmqContext) {
        await this.processEvent(context, 'order.cancelled', async () => {
            const { orderId } = data;
            const payment = await this.getPaymentUseCase.getPaymentByOrder(orderId);
            if (payment && payment.status === 'COMPLETED') {
                await this.refundPaymentUseCase.execute(payment.id);
            }
        });
    }

    private async processEvent(context: RmqContext, pattern: string, handler: () => unknown) {
        const channel = context.getChannelRef() as Channel;
        const msg = context.getMessage() as ConsumeMessage;

        try {
            await handler();
            channel.ack(msg);
        } catch (err) {
            const retries = this.getRetryCount(msg);
            const error = err instanceof Error ? err : new Error(String(err));

            if (retries >= MAX_RETRIES) {
                console.error(
                    `[PaymentService] Handler '${pattern}' falhou após ${MAX_RETRIES} tentativas. Enviando para DLQ.`,
                    {
                        pattern,
                        error: error.message,
                        retries,
                    }
                );
                // ACK para remover da fila principal e publicar na DLQ com pattern dedicado
                channel.ack(msg);
                const originalData = (JSON.parse(msg.content.toString()) as { data: unknown }).data;
                const dlqBuffer = Buffer.from(
                    JSON.stringify({ pattern: 'dlq.message', data: originalData })
                );
                channel.sendToQueue(QUEUES.PAYMENT_DLQ, dlqBuffer, {
                    persistent: true,
                    headers: {
                        ...msg.properties.headers,
                        'x-original-pattern': pattern,
                        'x-dead-reason': error.message,
                    },
                });
            } else {
                console.warn(
                    `[PaymentService] Handler '${pattern}' falhou. Agendando retry (${retries + 1}/${MAX_RETRIES}).`,
                    {
                        pattern,
                        error: error.message,
                    }
                );
                // NACK sem requeue → DLX roteia para retry queue com TTL
                channel.nack(msg, false, false);
            }
        }
    }

    private getRetryCount(msg: ConsumeMessage): number {
        const deaths = msg.properties.headers?.['x-death'] as
            | Array<{ queue: string; count: number }>
            | undefined;
        if (!deaths?.length) return 0;
        const retryDeath = deaths.find((d) => d.queue === QUEUES.PAYMENT_RETRY);
        return retryDeath?.count ?? 0;
    }
}
