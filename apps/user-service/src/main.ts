import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
        transport: Transport.TCP,
        options: {
            host: process.env.USER_SERVICE_HOST || '0.0.0.0',
            port: Number(process.env.USER_SERVICE_PORT) || 3001,
        },
    });

    await app.listen();
    console.log('User Service is listening on TCP port', process.env.USER_SERVICE_PORT || 3001);
}

bootstrap();
