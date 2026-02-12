import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';

import { OrderController } from './presentation/controllers/order.controller';
import { CreateOrderUseCase } from './application/use-cases/create-order.use-case';
import { GetOrderUseCase } from './application/use-cases/get-order.use-case';
import { UpdateOrderStatusUseCase } from './application/use-cases/update-order-status.use-case';
import { TypeOrmOrderRepository } from './infrastructure/database/repositories/typeorm-order.repository';
import { ORDER_REPOSITORY } from './domain/repositories/order.repository.interface';
import { OrderEntity } from './infrastructure/database/entities/order.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([OrderEntity]),
        ClientsModule.register([
            {
                name: 'EVENT_BUS',
                transport: Transport.RMQ,
                options: {
                    urls: [process.env.RMQ_URL || 'amqp://rabbitmq:5672'],
                    queue: 'payment_events',  // Publica para a fila do payment-service
                    queueOptions: {
                        durable: true,
                    },
                },
            },
        ]),
    ],
    controllers: [OrderController],
    providers: [
        CreateOrderUseCase,
        GetOrderUseCase,
        UpdateOrderStatusUseCase,
        {
            provide: ORDER_REPOSITORY,
            useClass: TypeOrmOrderRepository,
        },
    ],
})
export class OrderModule {}
