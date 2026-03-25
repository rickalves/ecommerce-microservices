import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';

import { OrderController } from './presentation/controllers/order.controller';
import { OrderDlqController } from './presentation/controllers/order-dlq.controller';
import { OrderHttpController } from './presentation/controllers/order-http.controller';
import { CreateOrderUseCase } from './application/use-cases/create-order.use-case';
import { GetOrderUseCase } from './application/use-cases/get-order.use-case';
import { UpdateOrderStatusUseCase } from './application/use-cases/update-order-status.use-case';
import { TypeOrmOrderRepository } from './infrastructure/database/repositories/typeorm-order.repository';
import { ORDER_REPOSITORY } from './domain/repositories/order.repository.interface';
import { OrderEntity } from './infrastructure/database/entities/order.entity';
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
        LoggerModule.forRoot({ serviceName: 'order-service' }),
        CorrelationModule,
        HealthModule.forRoot({ database: true, rabbitmq: true }),
        MetricsModule.forRoot({ serviceName: 'order-service' }),
        TracingModule,

        TypeOrmModule.forFeature([OrderEntity, OutboxEntity]),
        ClientsModule.register([
            {
                name: 'EVENT_BUS',
                transport: Transport.RMQ,
                options: {
                    urls: [process.env.RMQ_URL || 'amqp://rabbitmq:5672'],
                    queue: QUEUES.PAYMENT, // Publica para a fila do payment-service
                    queueOptions: {
                        durable: true,
                        arguments: {
                            'x-dead-letter-exchange': EXCHANGES.PAYMENT_DLX,
                            'x-dead-letter-routing-key': QUEUES.PAYMENT_RETRY,
                        },
                    },
                },
            },
        ]),
    ],
    controllers: [OrderController, OrderDlqController, OrderHttpController],
    providers: [
        CreateOrderUseCase,
        GetOrderUseCase,
        UpdateOrderStatusUseCase,
        RabbitMQSetupService,
        OutboxProcessor,
        {
            provide: ORDER_REPOSITORY,
            useClass: TypeOrmOrderRepository,
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
export class OrderModule {}
