import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { HttpModule } from '@nestjs/axios';

import { UsersController } from './users/users.controller';
import { OrdersController } from './orders/orders.controller';
import { PaymentsController } from './payments/payments.controller';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { QUEUES, EXCHANGES } from '@ecommerce/shared';

// Observability
import {
    LoggerModule,
    LoggerInterceptor,
    CorrelationModule,
    CorrelationMiddleware,
    HealthModule,
    MetricsModule,
    MetricsInterceptor,
} from '@ecommerce/observability';

@Module({
    imports: [
        // Observability modules
        LoggerModule.forRoot({ serviceName: 'api-gateway' }),
        CorrelationModule,
        HealthModule,
        MetricsModule.forRoot({ serviceName: 'api-gateway' }),

        // HTTP Client para queries síncronas
        HttpModule.register({
            timeout: 5000,
            maxRedirects: 5,
        }),

        // RabbitMQ para commands assíncronos
        ClientsModule.register([
            {
                name: 'USER_SERVICE',
                transport: Transport.TCP,
                options: {
                    host: process.env.USER_SERVICE_HOST || 'user-service',
                    port: Number(process.env.USER_SERVICE_PORT) || 4001,
                },
            },
            {
                name: 'ORDER_SERVICE_EVENTS',
                transport: Transport.RMQ,
                options: {
                    urls: [process.env.RMQ_URL || 'amqp://rabbitmq:5672'],
                    queue: QUEUES.ORDER,
                    queueOptions: {
                        durable: true,
                        arguments: {
                            'x-dead-letter-exchange': EXCHANGES.ORDER_DLX,
                            'x-dead-letter-routing-key': QUEUES.ORDER_RETRY,
                        },
                    },
                },
            },
            {
                name: 'PAYMENT_SERVICE_EVENTS',
                transport: Transport.RMQ,
                options: {
                    urls: [process.env.RMQ_URL || 'amqp://rabbitmq:5672'],
                    queue: QUEUES.PAYMENT,
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
        AuthModule,

    ],
    controllers: [UsersController, OrdersController, PaymentsController],
    providers: [
        {
            provide: APP_GUARD,
            useClass: JwtAuthGuard,
        },
        {
            provide: APP_INTERCEPTOR,
            useClass: LoggerInterceptor,
        },
        {
            provide: APP_INTERCEPTOR,
            useClass: MetricsInterceptor,
        },
    ],
})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer
            .apply(CorrelationMiddleware)
            .forRoutes('*');
    }
}
