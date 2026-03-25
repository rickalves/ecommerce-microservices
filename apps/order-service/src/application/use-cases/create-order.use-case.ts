import { Inject, Injectable } from '@nestjs/common';
import { CreateOrderDto, OrderCreatedAcceptedEvent } from '@ecommerce/shared';
import { MetricsService } from '@ecommerce/observability';

import { Order } from '../../domain/entities/order.entity';
import { ORDER_REPOSITORY } from '../../domain/repositories/order.repository.interface';
import type { IOrderRepository } from '../../domain/repositories/order.repository.interface';

@Injectable()
export class CreateOrderUseCase {
    constructor(
        @Inject(ORDER_REPOSITORY)
        private readonly orderRepository: IOrderRepository,
        private readonly metrics: MetricsService
    ) {}

    async execute(createOrderDto: CreateOrderDto): Promise<Order> {
        const order = Order.create(createOrderDto.userId, createOrderDto.items);

        this.metrics.ordersCreatedTotal.inc();

        const event: OrderCreatedAcceptedEvent = {
            correlationId: order.id,
            order,
        };

        // Persiste pedido + enfileira evento no outbox atomicamente
        const saved = await this.orderRepository.saveWithOutbox(order, {
            eventType: 'order.created.accepted',
            payload: event as unknown as Record<string, unknown>,
        });
        this.metrics.eventPublishedTotal.inc({ event_type: 'order.created.accepted' });

        return saved;
    }
}
