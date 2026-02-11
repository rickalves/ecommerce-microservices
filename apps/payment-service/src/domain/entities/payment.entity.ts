import { IPayment, PaymentStatus, PaymentMethod } from '@ecommerce/shared';

export class Payment implements IPayment {
    constructor(
        public id: string,
        public orderId: string,
        public userId: string,
        public amount: number,
        public status: PaymentStatus,
        public method: PaymentMethod,
        public createdAt: Date,
        public updatedAt: Date,
        public transactionId?: string
    ) {}

    static create(orderId: string, userId: string, amount: number, method: PaymentMethod): Payment {
        return new Payment(
            crypto.randomUUID(),
            orderId,
            userId,
            amount,
            PaymentStatus.PENDING,
            method,
            new Date(),
            new Date()
        );
    }

    process(transactionId: string): void {
        if (this.status !== PaymentStatus.PENDING) {
            throw new Error('Only pending payments can be processed');
        }
        this.status = PaymentStatus.PROCESSING;
        this.transactionId = transactionId;
        this.updatedAt = new Date();
    }

    complete(): void {
        if (this.status !== PaymentStatus.PROCESSING) {
            throw new Error('Only processing payments can be completed');
        }
        this.status = PaymentStatus.COMPLETED;
        this.updatedAt = new Date();
    }

    fail(): void {
        if (this.status === PaymentStatus.COMPLETED || this.status === PaymentStatus.REFUNDED) {
            throw new Error('Completed or refunded payments cannot be marked as failed');
        }
        this.status = PaymentStatus.FAILED;
        this.updatedAt = new Date();
    }

    refund(): void {
        if (this.status !== PaymentStatus.COMPLETED) {
            throw new Error('Only completed payments can be refunded');
        }
        this.status = PaymentStatus.REFUNDED;
        this.updatedAt = new Date();
    }
}
