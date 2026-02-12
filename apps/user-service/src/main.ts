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

    // Configurar microservice TCP para comunicação interna
    app.connectMicroservice<MicroserviceOptions>({
        transport: Transport.TCP,
        options: {
            host: '0.0.0.0',
            port: 4001, // Porta diferente para evitar conflito
        },
    });

    await app.startAllMicroservices();
    logger.info('User Service microservice listening on TCP port 4001');
    logger.info('User Service HTTP server starting on port 3001');
    logger.info('Health check available on port 3001/health');

    await app.listen(3001, '0.0.0.0');
}

bootstrap();
