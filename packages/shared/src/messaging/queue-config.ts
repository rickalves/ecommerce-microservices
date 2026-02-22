export const QUEUES = {
    ORDER: 'order_service.queue',
    ORDER_RETRY: 'order_service.retry.queue',
    ORDER_DLQ: 'order.dlq',
    PAYMENT: 'payment_service.queue',
    PAYMENT_RETRY: 'payment_service.retry.queue',
    PAYMENT_DLQ: 'payment.dlq',
} as const;

export const EXCHANGES = {
    ORDER_DLX: 'order.dlx',
    PAYMENT_DLX: 'payment.dlx',
} as const;

export const MAX_RETRIES = 3;
export const RETRY_TTL_MS = 5000;
