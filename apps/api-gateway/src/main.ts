import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

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
        .addTag('users', 'Gerenciamento de usuários')
        .addTag('orders', 'Gerenciamento de pedidos')
        .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);

    await app.listen(3000, '0.0.0.0');
    console.log('API Gateway is running on http://localhost:3000');
    console.log('Swagger UI available at http://localhost:3000/api/docs');
}

bootstrap();
