import './tracing';
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

    // Fila principal: recebe comandos do API Gateway e eventos do payment-service
    // inheritAppConfig: true garante que APP_INTERCEPTOR, APP_GUARD, etc. sejam herdados
    app.connectMicroservice<MicroserviceOptions>(
        {
            transport: Transport.RMQ,
            options: {
                urls: [rmqUrl],
                queue: QUEUES.ORDER,
                queueOptions: {
                    durable: true,
                    arguments: {
                        'x-dead-letter-exchange': EXCHANGES.ORDER_DLX,
                        'x-dead-letter-routing-key': QUEUES.ORDER_RETRY,
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
                queue: QUEUES.ORDER_DLQ,
                queueOptions: { durable: true },
                noAck: false,
                prefetchCount: 1,
            },
        },
        { inheritAppConfig: true }
    );

    await app.startAllMicroservices();
    logger.info(`Order Service listening on RabbitMQ queue: ${QUEUES.ORDER}`);
    logger.info(`Order Service DLQ consumer active on queue: ${QUEUES.ORDER_DLQ}`);
    logger.info('Health check available on port 3002/health');

    await app.listen(3002, '0.0.0.0');
}

bootstrap();
