import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common';
import { GetOrderUseCase } from '../../application/use-cases/get-order.use-case';

/**
 * HTTP REST Controller para queries síncronas do Order Service
 * Separa queries (HTTP) de commands (RabbitMQ) seguindo pattern CQRS
 */
@Controller('orders')
export class OrderHttpController {
    constructor(
        private readonly getOrderUseCase: GetOrderUseCase
    ) {}

    /**
     * GET /orders/:id
     * Busca um pedido específico por ID
     */
    @Get(':id')
    async getOrder(@Param('id') orderId: string) {
        const order = await this.getOrderUseCase.execute(orderId);
        if (!order) {
            throw new NotFoundException(`Order with ID ${orderId} not found`);
        }
        return order;
    }

    /**
     * GET /orders/user/:userId
     * Busca todos os pedidos de um usuário
     */
    @Get('user/:userId')
    async getOrdersByUser(@Param('userId') userId: string) {
        return this.getOrderUseCase.getOrdersByUser(userId);
    }

    /**
     * GET /orders
     * Lista todos os pedidos (com filtro opcional por userId)
     */
    @Get()
    async getAllOrders(@Query('userId') userId?: string) {
        if (userId) {
            return this.getOrderUseCase.getOrdersByUser(userId);
        }
        return this.getOrderUseCase.getAllOrders();
    }
}
