import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { OrderCancelledEvent } from '@ecommerce/shared';

import { Order } from '../../domain/entities/order.entity';
import { ORDER_REPOSITORY } from '../../domain/repositories/order.repository.interface';
import type { IOrderRepository } from '../../domain/repositories/order.repository.interface';

@Injectable()
export class UpdateOrderStatusUseCase {
    constructor(
        @Inject(ORDER_REPOSITORY)
        private readonly orderRepository: IOrderRepository,
        @Inject('EVENT_BUS') private readonly eventBus: ClientProxy
    ) {}

    async confirmOrder(orderId: string): Promise<Order> {
        const order = await this.orderRepository.findById(orderId);
        if (!order) {
            throw new Error('Order not found');
        }

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

        order.cancel();
        const updated = await this.orderRepository.save(order);

        // Publica evento de pedido cancelado para disparar compensações (ex: reembolso)
        try {
            const event: OrderCancelledEvent = {
                correlationId: updated.id,
                orderId: updated.id,
                reason: 'Order cancelled by user or due to payment failure',
            };
            this.eventBus.emit('order.cancelled', event);
        } catch (_) {
            // swallow to avoid failing cancellation on event publish issues
        }

        return updated;
    }
}
