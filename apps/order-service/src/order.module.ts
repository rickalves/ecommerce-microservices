import { Module } from '@nestjs/common';
import { OrderController } from './presentation/controllers/order.controller';
import { CreateOrderUseCase } from './application/use-cases/create-order.use-case';
import { GetOrderUseCase } from './application/use-cases/get-order.use-case';
import { UpdateOrderStatusUseCase } from './application/use-cases/update-order-status.use-case';
import { InMemoryOrderRepository } from './infrastructure/repositories/in-memory-order.repository';
import { ORDER_REPOSITORY } from './domain/repositories/order.repository.interface';

@Module({
  controllers: [OrderController],
  providers: [
    CreateOrderUseCase,
    GetOrderUseCase,
    UpdateOrderStatusUseCase,
    {
      provide: ORDER_REPOSITORY,
      useClass: InMemoryOrderRepository,
    },
  ],
})
export class OrderModule {}
