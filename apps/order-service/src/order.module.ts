import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OrderController } from './presentation/controllers/order.controller';
import { CreateOrderUseCase } from './application/use-cases/create-order.use-case';
import { GetOrderUseCase } from './application/use-cases/get-order.use-case';
import { UpdateOrderStatusUseCase } from './application/use-cases/update-order-status.use-case';
import { TypeOrmOrderRepository } from './infrastructure/database/repositories/typeorm-order.repository';
import { ORDER_REPOSITORY } from './domain/repositories/order.repository.interface';
import { OrderEntity } from './infrastructure/database/entities/order.entity';

@Module({
    imports: [TypeOrmModule.forFeature([OrderEntity])],
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
