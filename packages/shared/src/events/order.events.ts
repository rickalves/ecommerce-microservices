import { IOrder } from '../domain/order.interface';

/**
 * Evento publicado quando um pedido é criado e aceito para processamento
 */
export interface OrderCreatedAcceptedEvent {
    correlationId: string;
    order: IOrder;
}

/**
 * Evento publicado quando um pedido é cancelado (evento de domínio)
 * Dispara compensações como reembolso de pagamento
 */
export interface OrderCancelledEvent {
    correlationId: string;
    orderId: string;
    reason?: string;
}
