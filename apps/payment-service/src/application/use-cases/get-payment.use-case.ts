import { Inject, Injectable } from '@nestjs/common';

import { Payment } from '../../domain/entities/payment.entity';
import { PAYMENT_REPOSITORY } from '../../domain/repositories/payment.repository.interface';
import type { IPaymentRepository } from '../../domain/repositories/payment.repository.interface';

@Injectable()
export class GetPaymentUseCase {
    constructor(
        @Inject(PAYMENT_REPOSITORY)
        private readonly paymentRepository: IPaymentRepository
    ) {}

    async execute(paymentId: string): Promise<Payment> {
        const payment = await this.paymentRepository.findById(paymentId);

        if (!payment) {
            throw new Error('Payment not found');
        }

        return payment;
    }

    async getPaymentByOrder(orderId: string): Promise<Payment | null> {
        return this.paymentRepository.findByOrderId(orderId);
    }

    async getPaymentsByUser(userId: string): Promise<Payment[]> {
        return this.paymentRepository.findByUserId(userId);
    }

    async getAllPayments(): Promise<Payment[]> {
        return this.paymentRepository.findAll();
    }
}
