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
import { HttpService } from '@nestjs/axios';
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
    private readonly paymentServiceUrl: string;

    constructor(
        private readonly httpService: HttpService,
        @Inject('PAYMENT_SERVICE_EVENTS') private readonly paymentServiceEvents: ClientProxy
    ) {
        this.paymentServiceUrl = process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3003';
    }

    // ==================== COMMANDS (Assíncrono via RabbitMQ) ====================

    @Post()
    @ApiOperation({
        summary: 'Criar novo pagamento',
        description: 'Cria um novo pagamento para um pedido (assíncrono)',
    })
    @ApiBody({ type: CreatePaymentDto })
    @ApiResponse({
        status: 201,
        description: 'Pagamento aceito para processamento',
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
            // ⚡ Assíncrono: publish event (fire-and-forget)
            this.paymentServiceEvents.emit('payment.create', paymentPayload);
            return {
                status: 'accepted',
                message: 'Payment creation request accepted',
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new HttpException(message || 'Failed to create payment', HttpStatus.BAD_REQUEST);
        }
    }

    @Patch(':id/refund')
    @ApiOperation({
        summary: 'Reembolsar pagamento',
        description: 'Processa o reembolso de um pagamento completado (assíncrono)',
    })
    @ApiParam({
        name: 'id',
        description: 'ID do pagamento a ser reembolsado',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    @ApiResponse({
        status: 200,
        description: 'Reembolso aceito para processamento',
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
            this.paymentServiceEvents.emit('payment.refund', id);
            return { status: 'accepted', message: 'Refund payment request accepted' };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new HttpException(message || 'Failed to refund payment', HttpStatus.BAD_REQUEST);
        }
    }

    // ==================== QUERIES (Síncrono via HTTP) ====================

    @Get(':id')
    @ApiOperation({
        summary: 'Buscar pagamento por ID',
        description: 'Retorna os dados completos de um pagamento específico (síncrono via HTTP)',
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
            // ✅ Síncrono: HTTP direto
            const response = await firstValueFrom(
                this.httpService.get<PaymentResponseDto>(`${this.paymentServiceUrl}/payments/${id}`)
            );
            return response.data;
        } catch (error: any) {
            if (error.response?.status === 404) {
                throw new HttpException('Payment not found', HttpStatus.NOT_FOUND);
            }
            const message =
                error.response?.data?.message || error.message || 'Failed to fetch payment';
            throw new HttpException(
                message,
                error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get('order/:orderId')
    @ApiOperation({
        summary: 'Buscar pagamento por pedido',
        description: 'Retorna o pagamento associado a um pedido específico (síncrono via HTTP)',
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
            // ✅ Síncrono: HTTP direto
            const response = await firstValueFrom(
                this.httpService.get<PaymentResponseDto>(
                    `${this.paymentServiceUrl}/payments/order/${orderId}`
                )
            );
            return response.data;
        } catch (error: any) {
            if (error.response?.status === 404) {
                throw new HttpException('Payment not found for this order', HttpStatus.NOT_FOUND);
            }
            const message =
                error.response?.data?.message || error.message || 'Failed to fetch payment';
            throw new HttpException(
                message,
                error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get('user/:userId')
    @ApiOperation({
        summary: 'Buscar pagamentos por usuário',
        description: 'Retorna todos os pagamentos de um usuário específico (síncrono via HTTP)',
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
            // ✅ Síncrono: HTTP direto
            const response = await firstValueFrom(
                this.httpService.get<PaymentResponseDto[]>(
                    `${this.paymentServiceUrl}/payments/user/${userId}`
                )
            );
            return response.data;
        } catch (error: any) {
            const message =
                error.response?.data?.message || error.message || 'Failed to fetch payments';
            throw new HttpException(
                message,
                error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get()
    @ApiOperation({
        summary: 'Listar todos os pagamentos',
        description: 'Retorna uma lista com todos os pagamentos do sistema (síncrono via HTTP)',
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
            // ✅ Síncrono: HTTP direto
            const response = await firstValueFrom(
                this.httpService.get<PaymentResponseDto[]>(`${this.paymentServiceUrl}/payments`)
            );
            return response.data;
        } catch (error: any) {
            const message =
                error.response?.data?.message || error.message || 'Failed to fetch payments';
            throw new HttpException(
                message,
                error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }
}
