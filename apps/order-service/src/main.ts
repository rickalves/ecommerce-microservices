import {NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

import { AppModule } from './app.module';
import { LoggerService } from '@ecommerce/observability';

async function bootstrap() {
    const app = await NestFactory.create(AppModule, {
        bufferLogs: true,
    });

    // Configurar logger customizado
    const logger = app.get(LoggerService);
    app.useLogger(logger);

    // Connect to order_queue for direct commands
    app.connectMicroservice<MicroserviceOptions>({
        transport: Transport.RMQ,
        options: {
            urls: [process.env.RMQ_URL || 'amqp://rabbitmq:5672'],
            queue: 'order_queue',
            queueOptions: { durable: true },
        },
    });

    // Connect to events exchange for domain events
    app.connectMicroservice<MicroserviceOptions>({
        transport: Transport.RMQ,
        options: {
            urls: [process.env.RMQ_URL || 'amqp://rabbitmq:5672'],
            queue: 'order_events',
            queueOptions: {
                durable: true,
            },
            noAck: false,
            prefetchCount: 1,
        },
    });

    await app.startAllMicroservices();
    logger.info('Order Service is listening on RabbitMQ - order_queue and order_events');
    logger.info('Health check available on port 3002/health');

    await app.listen(3002, '0.0.0.0');
}

bootstrap();
