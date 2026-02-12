import { NestFactory } from '@nestjs/core';
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

    // Connect to payment_queue for direct commands
    app.connectMicroservice<MicroserviceOptions>({
        transport: Transport.RMQ,
        options: {
            urls: [process.env.RMQ_URL || 'amqp://rabbitmq:5672'],
            queue: 'payment_queue',
            queueOptions: { durable: true },
        },
    });

    // Connect to events exchange for domain events
    app.connectMicroservice<MicroserviceOptions>({
        transport: Transport.RMQ,
        options: {
            urls: [process.env.RMQ_URL || 'amqp://rabbitmq:5672'],
            queue: 'payment_events',
            queueOptions: {
                durable: true,
            },
            noAck: false,
            prefetchCount: 1,
        },
    });

    await app.startAllMicroservices();
    logger.info('Payment Service is listening on RabbitMQ - payment_queue and payment_events');
    logger.info('Health check available on port 3003/health');

    await app.listen(3003, '0.0.0.0');
}

bootstrap();
