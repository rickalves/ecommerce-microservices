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

    app.connectMicroservice<MicroserviceOptions>({
        transport: Transport.TCP,
        options: {
            host: process.env.USER_SERVICE_HOST || '0.0.0.0',
            port: Number(process.env.USER_SERVICE_PORT) || 3001,
        },
    });

    await app.startAllMicroservices();
    logger.info('User Service is listening on TCP port', process.env.USER_SERVICE_PORT || 3001);
    logger.info('Health check available on port 3001/health');

    await app.listen(3001, '0.0.0.0');
}

bootstrap();
