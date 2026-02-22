import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { connect } from 'amqplib';
import { QUEUES, EXCHANGES, RETRY_TTL_MS } from '@ecommerce/shared';

@Injectable()
export class RabbitMQSetupService implements OnApplicationBootstrap {
    async onApplicationBootstrap() {
        const url = process.env.RMQ_URL || 'amqp://rabbitmq:5672';
        const conn = await connect(url);
        const ch = await conn.createChannel();

        // 1. Dead Letter Exchange para order
        await ch.assertExchange(EXCHANGES.ORDER_DLX, 'direct', { durable: true });

        // 2. Retry queue: após TTL, reencaminha para a fila principal
        await ch.assertQueue(QUEUES.ORDER_RETRY, {
            durable: true,
            arguments: {
                'x-message-ttl': RETRY_TTL_MS,
                'x-dead-letter-exchange': '',
                'x-dead-letter-routing-key': QUEUES.ORDER,
            },
        });
        await ch.bindQueue(QUEUES.ORDER_RETRY, EXCHANGES.ORDER_DLX, QUEUES.ORDER_RETRY);

        // 3. DLQ final: mensagens que excederam MAX_RETRIES
        await ch.assertQueue(QUEUES.ORDER_DLQ, { durable: true });
        await ch.bindQueue(QUEUES.ORDER_DLQ, EXCHANGES.ORDER_DLX, QUEUES.ORDER_DLQ);

        await ch.close();
        await conn.close();
    }
}
