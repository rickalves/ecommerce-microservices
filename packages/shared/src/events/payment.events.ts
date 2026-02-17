import { IPayment } from '../domain/payment.interface';

/**
 * Evento publicado quando o processamento de pagamento é iniciado
 */
export interface PaymentInitiatedEvent {
    correlationId: string;
    payment: IPayment;
}

/**
 * Evento publicado quando o pagamento é completado com sucesso
 */
export interface PaymentCompletedEvent {
    correlationId: string;
    orderId: string;
    payment: IPayment;
}

/**
 * Evento publicado quando o pagamento falha
 */
export interface PaymentFailedEvent {
    correlationId: string;
    orderId: string;
    payment: IPayment;
    reason: string;
}

/**
 * Evento publicado quando um pagamento é reembolsado
 */
export interface PaymentRefundedEvent {
    correlationId: string;
    orderId: string;
    payment: IPayment;
}
