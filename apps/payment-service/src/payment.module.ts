import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';

import { PaymentController } from './presentation/controllers/payment.controller';
import { PaymentHttpController } from './presentation/controllers/payment-http.controller';
import { ProcessPaymentUseCase } from './application/use-cases/process-payment.use-case';
import { GetPaymentUseCase } from './application/use-cases/get-payment.use-case';
import { RefundPaymentUseCase } from './application/use-cases/refund-payment.use-case';
import { TypeOrmPaymentRepository } from './infrastructure/database/repositories/typeorm-payment.repository';
import { PAYMENT_REPOSITORY } from './domain/repositories/payment.repository.interface';
import { PaymentEntity } from './infrastructure/database/entities/payment.entity';

// Observability
import {
    LoggerModule,
    LoggerInterceptor,
    CorrelationModule,
    CorrelationInterceptor,
    HealthModule,
} from '@ecommerce/observability';

@Module({
    imports: [
        // Observability modules
        LoggerModule.forRoot({ serviceName: 'payment-service' }),
        CorrelationModule,
        HealthModule,

        TypeOrmModule.forFeature([PaymentEntity]),
        ClientsModule.register([
            {
                name: 'EVENT_BUS',
                transport: Transport.RMQ,
                options: {
                    urls: [process.env.RMQ_URL || 'amqp://rabbitmq:5672'],
                    queue: 'order_events',  // Publica para a fila do order-service
                    queueOptions: {
                        durable: true,
                    },
                },
            },
        ]),
    ],
    controllers: [PaymentController, PaymentHttpController],
    providers: [
        ProcessPaymentUseCase,
        GetPaymentUseCase,
        RefundPaymentUseCase,
        {
            provide: PAYMENT_REPOSITORY,
            useClass: TypeOrmPaymentRepository,
        },
        {
            provide: APP_INTERCEPTOR,
            useClass: LoggerInterceptor,
        },
        {
            provide: APP_INTERCEPTOR,
            useClass: CorrelationInterceptor,
        },
    ],
})
export class PaymentModule {}
