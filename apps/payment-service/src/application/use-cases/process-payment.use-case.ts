import { Inject, Injectable } from '@nestjs/common';
import {
    CreatePaymentDto,
    PaymentInitiatedEvent,
    PaymentCompletedEvent,
    PaymentFailedEvent,
} from '@ecommerce/shared';
import { ClientProxy } from '@nestjs/microservices';
import { MetricsService } from '@ecommerce/observability';

import { Payment } from '../../domain/entities/payment.entity';
import { PAYMENT_REPOSITORY } from '../../domain/repositories/payment.repository.interface';
import type { IPaymentRepository } from '../../domain/repositories/payment.repository.interface';

@Injectable()
export class ProcessPaymentUseCase {
    constructor(
        @Inject(PAYMENT_REPOSITORY)
        private readonly paymentRepository: IPaymentRepository,
        @Inject('EVENT_BUS') private readonly eventBus: ClientProxy,
        private readonly metrics: MetricsService
    ) {}

    async execute(createPaymentDto: CreatePaymentDto): Promise<Payment> {
        // Verifica se já existe pagamento para este pedido
        const existingPayment = await this.paymentRepository.findByOrderId(
            createPaymentDto.orderId
        );
        if (existingPayment) {
            throw new Error('Payment already exists for this order');
        }

        // Cria o pagamento
        const payment = Payment.create(
            createPaymentDto.orderId,
            createPaymentDto.userId,
            createPaymentDto.amount,
            createPaymentDto.method
        );

        const saved = await this.paymentRepository.save(payment);

        // Publica evento de pagamento iniciado
        const initiatedEvent: PaymentInitiatedEvent = {
            correlationId: saved.id,
            payment: saved,
        };
        this.eventBus.emit('payment.initiated', initiatedEvent);
        this.metrics.eventPublishedTotal.inc({ event_type: 'payment.initiated' });

        // Simula processamento do pagamento (em produção, integraria com gateway de pagamento)
        try {
            const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Atualiza para processando
            saved.process(transactionId);
            await this.paymentRepository.save(saved);

            // Simula sucesso do pagamento (90% de sucesso)
            const isSuccess = Math.random() > 0.1;

            if (isSuccess) {
                saved.complete();
                await this.paymentRepository.save(saved);

                // Publica evento de pagamento completado
                const completedEvent: PaymentCompletedEvent = {
                    correlationId: saved.id,
                    orderId: saved.orderId,
                    payment: saved,
                };
                this.eventBus.emit('payment.completed', completedEvent);
                this.metrics.eventPublishedTotal.inc({ event_type: 'payment.completed' });
                this.metrics.paymentsProcessedTotal.inc({ status: 'completed' });
            } else {
                saved.fail();
                await this.paymentRepository.save(saved);

                // Publica evento de pagamento falhou
                const failedEvent: PaymentFailedEvent = {
                    correlationId: saved.id,
                    orderId: saved.orderId,
                    payment: saved,
                    reason: 'Payment gateway declined the transaction',
                };
                this.eventBus.emit('payment.failed', failedEvent);
                this.metrics.eventPublishedTotal.inc({ event_type: 'payment.failed' });
                this.metrics.paymentsProcessedTotal.inc({ status: 'failed' });
            }
        } catch (error) {
            saved.fail();
            await this.paymentRepository.save(saved);

            const failedEvent: PaymentFailedEvent = {
                correlationId: saved.id,
                orderId: saved.orderId,
                payment: saved,
                reason: (error as Error).message,
            };
            this.eventBus.emit('payment.failed', failedEvent);
            this.metrics.eventPublishedTotal.inc({ event_type: 'payment.failed' });
            this.metrics.paymentsProcessedTotal.inc({ status: 'failed' });
        }

        return saved;
    }
}
