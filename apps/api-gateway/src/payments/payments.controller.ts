import {
    Body,
    Controller,
    Get,
    Inject,
    Param,
    Post,
    Patch,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiParam,
    ApiBody,
    ApiBearerAuth,
} from '@nestjs/swagger';
import { CreatePaymentDto, PaymentResponseDto } from '@ecommerce/shared';
import { firstValueFrom } from 'rxjs';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('payments')
@ApiBearerAuth('JWT-auth')
@Controller('payments')
export class PaymentsController {
    constructor(@Inject('PAYMENT_SERVICE') private readonly paymentService: ClientProxy) {}

    @Post()
    @ApiOperation({
        summary: 'Criar novo pagamento',
        description: 'Cria um novo pagamento para um pedido',
    })
    @ApiBody({ type: CreatePaymentDto })
    @ApiResponse({
        status: 201,
        description: 'Pagamento criado com sucesso',
        type: PaymentResponseDto,
    })
    @ApiResponse({
        status: 400,
        description: 'Dados inválidos',
        schema: {
            example: {
                statusCode: 400,
                message: 'Invalid payment data',
            },
        },
    })
    async createPayment(
        @Body() createPaymentDto: CreatePaymentDto,
        @CurrentUser('userId') userId: string
    ) {
        try {
            // Override userId from token (don't trust client input)
            const paymentPayload = { ...createPaymentDto, userId };
            // publish event (fire-and-forget) to allow async processing
            this.paymentService.emit('payment.create', paymentPayload);
            return {
                status: 'accepted',
                message: 'Payment creation request accepted',
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new HttpException(message || 'Failed to create payment', HttpStatus.BAD_REQUEST);
        }
    }

    @Get(':id')
    @ApiOperation({
        summary: 'Buscar pagamento por ID',
        description: 'Retorna os dados completos de um pagamento específico',
    })
    @ApiParam({
        name: 'id',
        description: 'ID único do pagamento',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    @ApiResponse({
        status: 200,
        description: 'Pagamento encontrado',
        type: PaymentResponseDto,
    })
    @ApiResponse({
        status: 404,
        description: 'Pagamento não encontrado',
        schema: {
            example: {
                statusCode: 404,
                message: 'Payment not found',
            },
        },
    })
    async getPayment(@Param('id') id: string) {
        try {
            const payment = await firstValueFrom(this.paymentService.send<PaymentResponseDto, string>('payment.get', id));
            if (!payment) {
                throw new HttpException('Payment not found', HttpStatus.NOT_FOUND);
            }
            return payment;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new HttpException(message || 'Payment not found', HttpStatus.NOT_FOUND);
        }
    }

    @Get('order/:orderId')
    @ApiOperation({
        summary: 'Buscar pagamento por pedido',
        description: 'Retorna o pagamento associado a um pedido específico',
    })
    @ApiParam({
        name: 'orderId',
        description: 'ID do pedido',
        example: '550e8400-e29b-41d4-a716-446655440001',
    })
    @ApiResponse({
        status: 200,
        description: 'Pagamento retornado',
        type: PaymentResponseDto,
    })
    @ApiResponse({
        status: 404,
        description: 'Pagamento não encontrado',
    })
    async getPaymentByOrder(@Param('orderId') orderId: string) {
        try {
            const payment = await firstValueFrom(this.paymentService.send<PaymentResponseDto, string>('payment.get_by_order', orderId));
            if (!payment) {
                throw new HttpException('Payment not found for this order', HttpStatus.NOT_FOUND);
            }
            return payment;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new HttpException(
                message || 'Failed to fetch payment',
                HttpStatus.NOT_FOUND
            );
        }
    }

    @Get('user/:userId')
    @ApiOperation({
        summary: 'Buscar pagamentos por usuário',
        description: 'Retorna todos os pagamentos de um usuário específico',
    })
    @ApiParam({
        name: 'userId',
        description: 'ID do usuário',
        example: '550e8400-e29b-41d4-a716-446655440001',
    })
    @ApiResponse({
        status: 200,
        description: 'Lista de pagamentos retornada',
        type: [PaymentResponseDto],
    })
    @ApiResponse({
        status: 500,
        description: 'Erro ao buscar pagamentos',
    })
    async getPaymentsByUser(@Param('userId') userId: string) {
        try {
            const payments = await firstValueFrom(this.paymentService.send<PaymentResponseDto[], string>('payment.get_by_user', userId));
            return payments;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new HttpException(
                message || 'Failed to fetch payments',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get()
    @ApiOperation({
        summary: 'Listar todos os pagamentos',
        description: 'Retorna uma lista com todos os pagamentos do sistema',
    })
    @ApiResponse({
        status: 200,
        description: 'Lista de pagamentos retornada com sucesso',
        type: [PaymentResponseDto],
    })
    @ApiResponse({
        status: 500,
        description: 'Erro interno ao buscar pagamentos',
    })
    async getAllPayments() {
        try {
            const payments = await firstValueFrom(this.paymentService.send<PaymentResponseDto[], any>('payment.get_all', {}));
            return payments;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new HttpException(
                message || 'Failed to fetch payments',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Patch(':id/refund')
    @ApiOperation({
        summary: 'Reembolsar pagamento',
        description: 'Processa o reembolso de um pagamento completado',
    })
    @ApiParam({
        name: 'id',
        description: 'ID do pagamento a ser reembolsado',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    @ApiResponse({
        status: 200,
        description: 'Reembolso processado com sucesso',
        type: PaymentResponseDto,
    })
    @ApiResponse({
        status: 400,
        description: 'Não foi possível reembolsar o pagamento',
        schema: {
            example: {
                statusCode: 400,
                message: 'Cannot refund payment',
            },
        },
    })
    async refundPayment(@Param('id') id: string) {
        try {
            this.paymentService.emit('payment.refund', id);
            return { status: 'accepted', message: 'Refund payment request accepted' };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new HttpException(message || 'Failed to refund payment', HttpStatus.BAD_REQUEST);
        }
    }
}
