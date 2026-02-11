import { Payment } from '../entities/payment.entity';

export interface IPaymentRepository {
    save(payment: Payment): Promise<Payment>;
    findById(id: string): Promise<Payment | null>;
    findByOrderId(orderId: string): Promise<Payment | null>;
    findByUserId(userId: string): Promise<Payment[]>;
    findAll(): Promise<Payment[]>;
    delete(id: string): Promise<void>;
}

export const PAYMENT_REPOSITORY = Symbol('PAYMENT_REPOSITORY');
