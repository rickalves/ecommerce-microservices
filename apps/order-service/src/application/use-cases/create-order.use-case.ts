import { Inject, Injectable } from '@nestjs/common';
import { CreateOrderDto } from '@ecommerce/shared';
import { Order } from '../../domain/entities/order.entity';
import { IOrderRepository, ORDER_REPOSITORY } from '../../domain/repositories/order.repository.interface';

@Injectable()
export class CreateOrderUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: IOrderRepository,
  ) {}

  async execute(createOrderDto: CreateOrderDto): Promise<Order> {
    const order = Order.create(createOrderDto.userId, createOrderDto.items);
    return this.orderRepository.save(order);
  }
}
