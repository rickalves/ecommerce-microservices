import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';

import { PaymentController } from './presentation/controllers/payment.controller';
import { PaymentDlqController } from './presentation/controllers/payment-dlq.controller';
import { PaymentHttpController } from './presentation/controllers/payment-http.controller';
import { ProcessPaymentUseCase } from './application/use-cases/process-payment.use-case';
import { GetPaymentUseCase } from './application/use-cases/get-payment.use-case';
import { RefundPaymentUseCase } from './application/use-cases/refund-payment.use-case';
import { TypeOrmPaymentRepository } from './infrastructure/database/repositories/typeorm-payment.repository';
import { PAYMENT_REPOSITORY } from './domain/repositories/payment.repository.interface';
import { PaymentEntity } from './infrastructure/database/entities/payment.entity';
import { OutboxEntity } from './infrastructure/database/entities/outbox.entity';
import { RabbitMQSetupService } from './infrastructure/messaging/rabbitmq-setup.service';
import { OutboxProcessor } from './infrastructure/messaging/outbox.processor';
import { QUEUES, EXCHANGES } from '@ecommerce/shared';

// Observability
import {
    LoggerModule,
    LoggerInterceptor,
    CorrelationModule,
    CorrelationInterceptor,
    HealthModule,
    MetricsModule,
    MetricsInterceptor,
    TracingModule,
    TracingInterceptor,
} from '@ecommerce/observability';

@Module({
    imports: [
        // Observability modules
        LoggerModule.forRoot({ serviceName: 'payment-service' }),
        CorrelationModule,
        HealthModule.forRoot({ database: true, rabbitmq: true }),
        MetricsModule.forRoot({ serviceName: 'payment-service' }),
        TracingModule,

        TypeOrmModule.forFeature([PaymentEntity, OutboxEntity]),
        ClientsModule.register([
            {
                name: 'EVENT_BUS',
                transport: Transport.RMQ,
                options: {
                    urls: [process.env.RMQ_URL || 'amqp://rabbitmq:5672'],
                    queue: QUEUES.ORDER, // Publica para a fila do order-service
                    queueOptions: {
                        durable: true,
                        arguments: {
                            'x-dead-letter-exchange': EXCHANGES.ORDER_DLX,
                            'x-dead-letter-routing-key': QUEUES.ORDER_RETRY,
                        },
                    },
                },
            },
        ]),
    ],
    controllers: [PaymentController, PaymentDlqController, PaymentHttpController],
    providers: [
        ProcessPaymentUseCase,
        GetPaymentUseCase,
        RefundPaymentUseCase,
        RabbitMQSetupService,
        OutboxProcessor,
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
        {
            provide: APP_INTERCEPTOR,
            useClass: MetricsInterceptor,
        },
        {
            provide: APP_INTERCEPTOR,
            useClass: TracingInterceptor,
        },
    ],
})
export class PaymentModule {}
