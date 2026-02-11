export interface IPayment {
    id: string;
    orderId: string;
    userId: string;
    amount: number;
    status: PaymentStatus;
    method: PaymentMethod;
    transactionId?: string;
    createdAt: Date;
    updatedAt: Date;
}

export enum PaymentStatus {
    PENDING = 'PENDING',
    PROCESSING = 'PROCESSING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    REFUNDED = 'REFUNDED',
}

export enum PaymentMethod {
    CREDIT_CARD = 'CREDIT_CARD',
    DEBIT_CARD = 'DEBIT_CARD',
    PIX = 'PIX',
    BOLETO = 'BOLETO',
}
