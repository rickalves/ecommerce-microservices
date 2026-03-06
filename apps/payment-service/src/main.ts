import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

import { AppModule } from './app.module';
import { LoggerService } from '@ecommerce/observability';
import { QUEUES, EXCHANGES } from '@ecommerce/shared';

async function bootstrap() {
    const app = await NestFactory.create(AppModule, {
        bufferLogs: true,
    });

    const logger = app.get(LoggerService);
    app.useLogger(logger);

    const rmqUrl = process.env.RMQ_URL || 'amqp://rabbitmq:5672';

    // Fila principal: recebe comandos do API Gateway e eventos do order-service
    // inheritAppConfig: true garante que APP_INTERCEPTOR, APP_GUARD, etc. sejam herdados
    app.connectMicroservice<MicroserviceOptions>(
        {
            transport: Transport.RMQ,
            options: {
                urls: [rmqUrl],
                queue: QUEUES.PAYMENT,
                queueOptions: {
                    durable: true,
                    arguments: {
                        'x-dead-letter-exchange': EXCHANGES.PAYMENT_DLX,
                        'x-dead-letter-routing-key': QUEUES.PAYMENT_RETRY,
                    },
                },
                noAck: false,
                prefetchCount: 10,
            },
        },
        { inheritAppConfig: true }
    );

    // Fila DLQ: consumer de mensagens que esgotaram as tentativas de retry
    app.connectMicroservice<MicroserviceOptions>(
        {
            transport: Transport.RMQ,
            options: {
                urls: [rmqUrl],
                queue: QUEUES.PAYMENT_DLQ,
                queueOptions: { durable: true },
                noAck: false,
                prefetchCount: 1,
            },
        },
        { inheritAppConfig: true }
    );

    await app.startAllMicroservices();
    logger.info(`Payment Service listening on RabbitMQ queue: ${QUEUES.PAYMENT}`);
    logger.info(`Payment Service DLQ consumer active on queue: ${QUEUES.PAYMENT_DLQ}`);
    logger.info('Health check available on port 3003/health');

    await app.listen(3003, '0.0.0.0');
}

bootstrap();
