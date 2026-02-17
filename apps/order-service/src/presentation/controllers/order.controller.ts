import { Controller } from '@nestjs/common';
import { Payload, EventPattern } from '@nestjs/microservices';
import { CreateOrderDto } from '@ecommerce/shared';

import { CreateOrderUseCase } from '../../application/use-cases/create-order.use-case';
import { UpdateOrderStatusUseCase } from '../../application/use-cases/update-order-status.use-case';

/**
 * RabbitMQ Event Handler para Commands assíncronos do Order Service
 * Queries síncronas são tratadas pelo OrderHttpController
 */
@Controller()
export class OrderController {
    constructor(
        private readonly createOrderUseCase: CreateOrderUseCase,
        private readonly updateOrderStatusUseCase: UpdateOrderStatusUseCase
    ) {}

    @EventPattern('order.created')
    async handleOrderCreated(@Payload() createOrderDto: CreateOrderDto) {
        // handle fire-and-forget order creation events
        return this.createOrderUseCase.execute(createOrderDto);
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
