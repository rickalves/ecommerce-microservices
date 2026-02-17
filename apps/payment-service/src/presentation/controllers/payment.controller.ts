import { Controller } from '@nestjs/common';
import { Payload, EventPattern } from '@nestjs/microservices';
import { CreatePaymentDto } from '@ecommerce/shared';

import { ProcessPaymentUseCase } from '../../application/use-cases/process-payment.use-case';
import { GetPaymentUseCase } from '../../application/use-cases/get-payment.use-case';
import { RefundPaymentUseCase } from '../../application/use-cases/refund-payment.use-case';

/**
 * RabbitMQ Event Handler para Commands assíncronos do Payment Service
 * Queries síncronas são tratadas pelo PaymentHttpController
 */
@Controller()
export class PaymentController {
    constructor(
        private readonly processPaymentUseCase: ProcessPaymentUseCase,
        private readonly getPaymentUseCase: GetPaymentUseCase,
        private readonly refundPaymentUseCase: RefundPaymentUseCase
    ) {}

    @EventPattern('order.created.accepted')
    async handleOrderCreatedAccepted(@Payload() data: any) {
        // Quando um pedido é aceito, cria um pagamento automaticamente
        const { order } = data;
        const createPaymentDto: CreatePaymentDto = {
            orderId: order.id,
            userId: order.userId,
            amount: order.totalAmount,
            method: 'CREDIT_CARD' as any, // Default method, in production would come from order data
        };

        return this.processPaymentUseCase.execute(createPaymentDto);
    }

    @EventPattern('payment.create')
    async handlePaymentCreate(@Payload() createPaymentDto: CreatePaymentDto) {
        return this.processPaymentUseCase.execute(createPaymentDto);
    }

    @EventPattern('payment.refund')
    async refundPayment(@Payload() paymentId: string) {
        return this.refundPaymentUseCase.execute(paymentId);
    }

    @EventPattern('order.cancelled')
    async handleOrderCancelled(@Payload() data: any) {
        // Quando um pedido é cancelado, tenta reembolsar o pagamento se existir
        const { orderId } = data;
        const payment = await this.getPaymentUseCase.getPaymentByOrder(orderId);

        if (payment && payment.status === 'COMPLETED') {
            return this.refundPaymentUseCase.execute(payment.id);
        }
    }
}
