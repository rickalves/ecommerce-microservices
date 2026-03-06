import { Controller } from '@nestjs/common';
import { Payload, EventPattern, Ctx, RmqContext } from '@nestjs/microservices';
import type { ConsumeMessage, Channel } from 'amqplib';
import { CreateOrderDto } from '@ecommerce/shared';
import type {
    PaymentInitiatedEvent,
    PaymentCompletedEvent,
    PaymentFailedEvent,
    PaymentRefundedEvent,
} from '@ecommerce/shared';
import { QUEUES, MAX_RETRIES } from '@ecommerce/shared';

import { CreateOrderUseCase } from '../../application/use-cases/create-order.use-case';
import { UpdateOrderStatusUseCase } from '../../application/use-cases/update-order-status.use-case';

/**
 * RabbitMQ Event Handler para Commands assíncronos do Order Service.
 * Queries síncronas são tratadas pelo OrderHttpController.
 *
 * Implementa ACK manual: confirma a mensagem após processamento bem-sucedido.
 * Em caso de falha, aplica retry via DLX (até MAX_RETRIES tentativas).
 * Após MAX_RETRIES, envia para a DLQ com pattern 'dlq.message'.
 */
@Controller()
export class OrderController {
    constructor(
        private readonly createOrderUseCase: CreateOrderUseCase,
        private readonly updateOrderStatusUseCase: UpdateOrderStatusUseCase
    ) {}

    @EventPattern('order.created')
    async handleOrderCreated(
        @Payload() createOrderDto: CreateOrderDto,
        @Ctx() context: RmqContext
    ) {
        await this.processEvent(context, 'order.created', () =>
            this.createOrderUseCase.execute(createOrderDto)
        );
    }

    @EventPattern('order.confirm')
    async confirmOrder(@Payload() orderId: string, @Ctx() context: RmqContext) {
        await this.processEvent(context, 'order.confirm', () =>
            this.updateOrderStatusUseCase.confirmOrder(orderId)
        );
    }

    @EventPattern('order.ship')
    async shipOrder(@Payload() orderId: string, @Ctx() context: RmqContext) {
        await this.processEvent(context, 'order.ship', () =>
            this.updateOrderStatusUseCase.shipOrder(orderId)
        );
    }

    @EventPattern('order.deliver')
    async deliverOrder(@Payload() orderId: string, @Ctx() context: RmqContext) {
        await this.processEvent(context, 'order.deliver', () =>
            this.updateOrderStatusUseCase.deliverOrder(orderId)
        );
    }

    @EventPattern('order.cancel')
    async cancelOrder(@Payload() orderId: string, @Ctx() context: RmqContext) {
        await this.processEvent(context, 'order.cancel', () =>
            this.updateOrderStatusUseCase.cancelOrder(orderId)
        );
    }

    @EventPattern('payment.initiated')
    async handlePaymentInitiated(
        @Payload() data: PaymentInitiatedEvent,
        @Ctx() context: RmqContext
    ) {
        await this.processEvent(context, 'payment.initiated', () => {
            console.log(`Payment initiated for order: ${data.payment.orderId}`);
        });
    }

    @EventPattern('payment.completed')
    async handlePaymentCompleted(
        @Payload() data: PaymentCompletedEvent,
        @Ctx() context: RmqContext
    ) {
        await this.processEvent(context, 'payment.completed', async () => {
            if (data.orderId) {
                await this.updateOrderStatusUseCase.confirmOrder(data.orderId);
            }
        });
    }

    @EventPattern('payment.failed')
    async handlePaymentFailed(@Payload() data: PaymentFailedEvent, @Ctx() context: RmqContext) {
        await this.processEvent(context, 'payment.failed', async () => {
            if (data.orderId) {
                await this.updateOrderStatusUseCase.cancelOrder(data.orderId);
            }
        });
    }

    @EventPattern('payment.refunded')
    async handlePaymentRefunded(@Payload() data: PaymentRefundedEvent, @Ctx() context: RmqContext) {
        await this.processEvent(context, 'payment.refunded', () => {
            console.log(`Payment refunded for order: ${data.orderId}`);
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
                    `[OrderService] Handler '${pattern}' falhou após ${MAX_RETRIES} tentativas. Enviando para DLQ.`,
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
                channel.sendToQueue(QUEUES.ORDER_DLQ, dlqBuffer, {
                    persistent: true,
                    headers: {
                        ...msg.properties.headers,
                        'x-original-pattern': pattern,
                        'x-dead-reason': error.message,
                    },
                });
            } else {
                console.warn(
                    `[OrderService] Handler '${pattern}' falhou. Agendando retry (${retries + 1}/${MAX_RETRIES}).`,
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
        const retryDeath = deaths.find((d) => d.queue === QUEUES.ORDER_RETRY);
        return retryDeath?.count ?? 0;
    }
}
