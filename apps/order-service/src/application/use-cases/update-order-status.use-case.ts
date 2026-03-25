import { Inject, Injectable } from '@nestjs/common';
import { OrderCancelledEvent, OrderStatus } from '@ecommerce/shared';

import { Order } from '../../domain/entities/order.entity';
import { ORDER_REPOSITORY } from '../../domain/repositories/order.repository.interface';
import type { IOrderRepository } from '../../domain/repositories/order.repository.interface';

@Injectable()
export class UpdateOrderStatusUseCase {
    constructor(
        @Inject(ORDER_REPOSITORY)
        private readonly orderRepository: IOrderRepository
    ) {}

    async confirmOrder(orderId: string): Promise<Order> {
        const order = await this.orderRepository.findById(orderId);
        if (!order) {
            throw new Error('Order not found');
        }
        // Idempotente: se já confirmado (reentrega do outbox), apenas retorna
        if (order.status === OrderStatus.CONFIRMED) return order;

        order.confirm();
        return this.orderRepository.save(order);
    }

    async shipOrder(orderId: string): Promise<Order> {
        const order = await this.orderRepository.findById(orderId);
        if (!order) {
            throw new Error('Order not found');
        }

        order.ship();
        return this.orderRepository.save(order);
    }

    async deliverOrder(orderId: string): Promise<Order> {
        const order = await this.orderRepository.findById(orderId);
        if (!order) {
            throw new Error('Order not found');
        }

        order.deliver();
        return this.orderRepository.save(order);
    }

    async cancelOrder(orderId: string): Promise<Order> {
        const order = await this.orderRepository.findById(orderId);
        if (!order) {
            throw new Error('Order not found');
        }
        // Idempotente: se já cancelado (reentrega do outbox), apenas retorna
        if (order.status === OrderStatus.CANCELLED) return order;

        order.cancel();

        const event: OrderCancelledEvent = {
            correlationId: order.id,
            orderId: order.id,
            reason: 'Order cancelled by user or due to payment failure',
        };

        // Persiste CANCELLED + enfileira evento no outbox atomicamente
        return this.orderRepository.saveWithOutbox(order, {
            eventType: 'order.cancelled',
            payload: event as unknown as Record<string, unknown>,
        });
    }
}
