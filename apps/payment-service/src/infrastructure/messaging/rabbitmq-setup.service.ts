import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { connect } from 'amqplib';
import { QUEUES, EXCHANGES, RETRY_TTL_MS } from '@ecommerce/shared';

@Injectable()
export class RabbitMQSetupService implements OnApplicationBootstrap {
    async onApplicationBootstrap() {
        const url = process.env.RMQ_URL || 'amqp://rabbitmq:5672';
        const conn = await connect(url);
        const ch = await conn.createChannel();

        // 1. Dead Letter Exchange para payment
        await ch.assertExchange(EXCHANGES.PAYMENT_DLX, 'direct', { durable: true });

        // 2. Retry queue: após TTL, reencaminha para a fila principal
        await ch.assertQueue(QUEUES.PAYMENT_RETRY, {
            durable: true,
            arguments: {
                'x-message-ttl': RETRY_TTL_MS,
                'x-dead-letter-exchange': '',
                'x-dead-letter-routing-key': QUEUES.PAYMENT,
            },
        });
        await ch.bindQueue(QUEUES.PAYMENT_RETRY, EXCHANGES.PAYMENT_DLX, QUEUES.PAYMENT_RETRY);

        // 3. DLQ final: mensagens que excederam MAX_RETRIES
        await ch.assertQueue(QUEUES.PAYMENT_DLQ, { durable: true });
        await ch.bindQueue(QUEUES.PAYMENT_DLQ, EXCHANGES.PAYMENT_DLX, QUEUES.PAYMENT_DLQ);

        await ch.close();
        await conn.close();
    }
}
