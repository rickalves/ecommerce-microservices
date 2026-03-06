import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common';
import { GetPaymentUseCase } from '../../application/use-cases/get-payment.use-case';

/**
 * HTTP REST Controller para queries síncronas do Payment Service
 * Separa queries (HTTP) de commands (RabbitMQ) seguindo pattern CQRS
 */
@Controller('payments')
export class PaymentHttpController {
    constructor(private readonly getPaymentUseCase: GetPaymentUseCase) {}

    /**
     * GET /payments/:id
     * Busca um pagamento específico por ID
     */
    @Get(':id')
    async getPayment(@Param('id') paymentId: string) {
        const payment = await this.getPaymentUseCase.execute(paymentId);
        if (!payment) {
            throw new NotFoundException(`Payment with ID ${paymentId} not found`);
        }
        return payment;
    }

    /**
     * GET /payments/order/:orderId
     * Busca o pagamento associado a um pedido
     */
    @Get('order/:orderId')
    async getPaymentByOrder(@Param('orderId') orderId: string) {
        const payment = await this.getPaymentUseCase.getPaymentByOrder(orderId);
        if (!payment) {
            throw new NotFoundException(`Payment for order ${orderId} not found`);
        }
        return payment;
    }

    /**
     * GET /payments/user/:userId
     * Busca todos os pagamentos de um usuário
     */
    @Get('user/:userId')
    async getPaymentsByUser(@Param('userId') userId: string) {
        return this.getPaymentUseCase.getPaymentsByUser(userId);
    }

    /**
     * GET /payments
     * Lista todos os pagamentos (com filtro opcional por userId)
     */
    @Get()
    async getAllPayments(@Query('userId') userId?: string) {
        if (userId) {
            return this.getPaymentUseCase.getPaymentsByUser(userId);
        }
        return this.getPaymentUseCase.getAllPayments();
    }
}
