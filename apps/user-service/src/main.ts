import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
        transport: Transport.RMQ,
        options: {
            urls: [process.env.RMQ_URL || 'amqp://rabbitmq:5672'],
            queue: 'user_queue',
            queueOptions: { durable: true },
        },
    });

    await app.listen();
    console.log('User Service is listening on port 3001');
}

bootstrap();
