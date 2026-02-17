import { Inject, Injectable } from '@nestjs/common';
import { CreateOrderDto, OrderCreatedAcceptedEvent } from '@ecommerce/shared';
import { ClientProxy } from '@nestjs/microservices';

import { Order } from '../../domain/entities/order.entity';
import { ORDER_REPOSITORY } from '../../domain/repositories/order.repository.interface';
import type { IOrderRepository } from '../../domain/repositories/order.repository.interface';

@Injectable()
export class CreateOrderUseCase {
    constructor(
        @Inject(ORDER_REPOSITORY)
        private readonly orderRepository: IOrderRepository,
        @Inject('EVENT_BUS') private readonly eventBus: ClientProxy
    ) {}

    async execute(createOrderDto: CreateOrderDto): Promise<Order> {
        const order = Order.create(createOrderDto.userId, createOrderDto.items);
        const saved = await this.orderRepository.save(order);

        // publish accepted event (fire-and-forget) with correlationId
        try {
            const event: OrderCreatedAcceptedEvent = {
                correlationId: saved.id,
                order: saved,
            };
            this.eventBus.emit('order.created.accepted', event);
        } catch (_) {
            // swallow to avoid failing creation on event publish issues
        }

        return saved;
    }
}
