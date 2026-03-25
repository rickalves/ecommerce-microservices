import './tracing';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { LoggerService } from '@ecommerce/observability';

async function bootstrap() {
    const app = await NestFactory.create(AppModule, {
        bufferLogs: true,
    });

    // Configurar logger customizado
    const logger = app.get(LoggerService);
    app.useLogger(logger);

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        })
    );

    app.enableCors();

    // Configuração do Swagger
    const config = new DocumentBuilder()
        .setTitle('E-commerce Microservices API')
        .setDescription('API Gateway para o sistema de e-commerce com arquitetura de microserviços')
        .setVersion('1.0')
        .addTag('auth', 'Autenticação JWT')
        .addTag('users', 'Gerenciamento de usuários')
        .addTag('orders', 'Gerenciamento de pedidos')
        .addBearerAuth(
            {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                description: 'Enter JWT token',
                name: 'Authorization',
                in: 'header',
            },
            'JWT-auth'
        )
        .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);

    await app.listen(3000, '0.0.0.0');
    logger.info('API Gateway is running on http://localhost:3000');
    logger.info('Swagger UI available at http://localhost:3000/api/docs');
    logger.info('Health check available at http://localhost:3000/health');
}

bootstrap();
