import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { PaymentRefundedEvent } from '@ecommerce/shared';

import { Payment } from '../../domain/entities/payment.entity';
import { PAYMENT_REPOSITORY } from '../../domain/repositories/payment.repository.interface';
import type { IPaymentRepository } from '../../domain/repositories/payment.repository.interface';

@Injectable()
export class RefundPaymentUseCase {
    constructor(
        @Inject(PAYMENT_REPOSITORY)
        private readonly paymentRepository: IPaymentRepository,
        @Inject('EVENT_BUS') private readonly eventBus: ClientProxy
    ) {}

    async execute(paymentId: string): Promise<Payment> {
        const payment = await this.paymentRepository.findById(paymentId);

        if (!payment) {
            throw new Error('Payment not found');
        }

        payment.refund();
        const updated = await this.paymentRepository.save(payment);

        // Publica evento de reembolso
        const refundedEvent: PaymentRefundedEvent = {
            correlationId: updated.id,
            orderId: updated.orderId,
            payment: updated,
        };
        this.eventBus.emit('payment.refunded', refundedEvent);

        return updated;
    }
}
