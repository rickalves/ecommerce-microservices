import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CreateOrderDto } from '@ecommerce/shared';
import { CreateOrderUseCase } from '../../application/use-cases/create-order.use-case';
import { GetOrderUseCase } from '../../application/use-cases/get-order.use-case';
import { UpdateOrderStatusUseCase } from '../../application/use-cases/update-order-status.use-case';

@Controller()
export class OrderController {
  constructor(
    private readonly createOrderUseCase: CreateOrderUseCase,
    private readonly getOrderUseCase: GetOrderUseCase,
    private readonly updateOrderStatusUseCase: UpdateOrderStatusUseCase,
  ) {}

  @MessagePattern({ cmd: 'create_order' })
  async createOrder(@Payload() createOrderDto: CreateOrderDto) {
    return this.createOrderUseCase.execute(createOrderDto);
  }

  @MessagePattern({ cmd: 'get_order' })
  async getOrder(@Payload() orderId: string) {
    return this.getOrderUseCase.execute(orderId);
  }

  @MessagePattern({ cmd: 'get_orders_by_user' })
  async getOrdersByUser(@Payload() userId: string) {
    return this.getOrderUseCase.getOrdersByUser(userId);
  }

  @MessagePattern({ cmd: 'get_all_orders' })
  async getAllOrders() {
    return this.getOrderUseCase.getAllOrders();
  }

  @MessagePattern({ cmd: 'confirm_order' })
  async confirmOrder(@Payload() orderId: string) {
    return this.updateOrderStatusUseCase.confirmOrder(orderId);
  }

  @MessagePattern({ cmd: 'ship_order' })
  async shipOrder(@Payload() orderId: string) {
    return this.updateOrderStatusUseCase.shipOrder(orderId);
  }

  @MessagePattern({ cmd: 'deliver_order' })
  async deliverOrder(@Payload() orderId: string) {
    return this.updateOrderStatusUseCase.deliverOrder(orderId);
  }

  @MessagePattern({ cmd: 'cancel_order' })
  async cancelOrder(@Payload() orderId: string) {
    return this.updateOrderStatusUseCase.cancelOrder(orderId);
  }
}
