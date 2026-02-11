import { Controller } from '@nestjs/common';
import { Payload, EventPattern, MessagePattern } from '@nestjs/microservices';
import { CreateOrderDto } from '@ecommerce/shared';

import { CreateOrderUseCase } from '../../application/use-cases/create-order.use-case';
import { GetOrderUseCase } from '../../application/use-cases/get-order.use-case';
import { UpdateOrderStatusUseCase } from '../../application/use-cases/update-order-status.use-case';

@Controller()
export class OrderController {
    constructor(
        private readonly createOrderUseCase: CreateOrderUseCase,
        private readonly getOrderUseCase: GetOrderUseCase,
        private readonly updateOrderStatusUseCase: UpdateOrderStatusUseCase
    ) {}

    @EventPattern('order.created')
    async handleOrderCreated(@Payload() createOrderDto: CreateOrderDto) {
        // handle fire-and-forget order creation events
        return this.createOrderUseCase.execute(createOrderDto);
    }
    @EventPattern('order.get')
    async getOrder(@Payload() orderId: string) {
        return this.getOrderUseCase.execute(orderId);
    }

    @MessagePattern('order.get')
    async getOrderCommand(@Payload() orderId: string) {
        return this.getOrderUseCase.execute(orderId);
    }

    @EventPattern('order.get_by_user')
    async getOrdersByUser(@Payload() userId: string) {
        return this.getOrderUseCase.getOrdersByUser(userId);
    }

    @MessagePattern('order.get_by_user')
    async getOrdersByUserCommand(@Payload() userId: string) {
        return this.getOrderUseCase.getOrdersByUser(userId);
    }

    @EventPattern('order.get_all')
    async getAllOrders() {
        return this.getOrderUseCase.getAllOrders();
    }

    @MessagePattern('order.get_all')
    async getAllOrdersCommand() {
        return this.getOrderUseCase.getAllOrders();
    }

    @EventPattern('order.confirm')
    async confirmOrder(@Payload() orderId: string) {
        return this.updateOrderStatusUseCase.confirmOrder(orderId);
    }

    @EventPattern('order.ship')
    async shipOrder(@Payload() orderId: string) {
        return this.updateOrderStatusUseCase.shipOrder(orderId);
    }

    @EventPattern('order.deliver')
    async deliverOrder(@Payload() orderId: string) {
        return this.updateOrderStatusUseCase.deliverOrder(orderId);
    }

    @EventPattern('order.cancel')
    async cancelOrder(@Payload() orderId: string) {
        return this.updateOrderStatusUseCase.cancelOrder(orderId);
    }

    @EventPattern('payment.completed')
    async handlePaymentCompleted(@Payload() data: any) {
        // Quando pagamento é completado, confirma o pedido
        const { orderId } = data;
        if (orderId) {
            return this.updateOrderStatusUseCase.confirmOrder(orderId);
        }
    }

    @EventPattern('payment.failed')
    async handlePaymentFailed(@Payload() data: any) {
        // Quando pagamento falha, cancela o pedido
        const { orderId } = data;
        if (orderId) {
            return this.updateOrderStatusUseCase.cancelOrder(orderId);
        }
    }
}
