import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // Connect to order_queue for direct commands
    app.connectMicroservice<MicroserviceOptions>({
        transport: Transport.RMQ,
        options: {
            urls: [process.env.RMQ_URL || 'amqp://rabbitmq:5672'],
            queue: 'order_queue',
            queueOptions: { durable: true },
        },
    });

    // Connect to events queue for domain events
    app.connectMicroservice<MicroserviceOptions>({
        transport: Transport.RMQ,
        options: {
            urls: [process.env.RMQ_URL || 'amqp://rabbitmq:5672'],
            queue: 'events',
            queueOptions: { durable: true },
        },
    });

    await app.startAllMicroservices();
    console.log('Order Service is listening on RabbitMQ - order_queue and events');
}

bootstrap();
