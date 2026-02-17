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
import { CreateOrderDto, OrderResponseDto } from '@ecommerce/shared';
import { firstValueFrom } from 'rxjs';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('orders')
@ApiBearerAuth('JWT-auth')
@Controller('orders')
export class OrdersController {
    private readonly orderServiceUrl: string;

    constructor(
        private readonly httpService: HttpService,
        @Inject('ORDER_SERVICE_EVENTS') private readonly orderServiceEvents: ClientProxy
    ) {
        this.orderServiceUrl = process.env.ORDER_SERVICE_URL || 'http://order-service:3002';
    }

    // ==================== COMMANDS (Assíncrono via RabbitMQ) ====================

    @Post()
    @ApiOperation({
        summary: 'Criar novo pedido',
        description: 'Cria um novo pedido para o usuário autenticado com lista de itens (assíncrono)',
    })
    @ApiBody({ type: CreateOrderDto })
    @ApiResponse({
        status: 201,
        description: 'Pedido aceito para processamento',
        type: OrderResponseDto,
    })
    @ApiResponse({
        status: 400,
        description: 'Dados inválidos',
        schema: {
            example: {
                statusCode: 400,
                message: 'Invalid order data',
            },
        },
    })
    async createOrder(
        @Body() createOrderDto: CreateOrderDto,
        @CurrentUser('userId') userId: string
    ) {
        try {
            // Override userId from token (don't trust client input)
            const orderPayload = { ...createOrderDto, userId };
            // ⚡ Assíncrono: publish event (fire-and-forget)
            this.orderServiceEvents.emit('order.created', orderPayload);
            return {
                status: 'accepted',
                message: 'Order creation request accepted',
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new HttpException(message || 'Failed to create order', HttpStatus.BAD_REQUEST);
        }
    }

    @Patch(':id/confirm')
    @ApiOperation({
        summary: 'Confirmar pedido',
        description: 'Muda o status do pedido de PENDING para CONFIRMED (assíncrono)',
    })
    @ApiParam({
        name: 'id',
        description: 'ID do pedido a ser confirmado',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    @ApiResponse({
        status: 200,
        description: 'Confirmação aceita para processamento',
        type: OrderResponseDto,
    })
    @ApiResponse({
        status: 400,
        description: 'Não foi possível confirmar o pedido (status inválido)',
        schema: {
            example: {
                statusCode: 400,
                message: 'Cannot confirm order in current status',
            },
        },
    })
    async confirmOrder(@Param('id') id: string) {
        try {
            this.orderServiceEvents.emit('order.confirm', id);
            return { status: 'accepted', message: 'Confirm order request accepted' };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new HttpException(message || 'Failed to confirm order', HttpStatus.BAD_REQUEST);
        }
    }

    @Patch(':id/ship')
    @ApiOperation({
        summary: 'Enviar pedido',
        description: 'Muda o status do pedido de CONFIRMED para SHIPPED (assíncrono)',
    })
    @ApiParam({
        name: 'id',
        description: 'ID do pedido a ser enviado',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    @ApiResponse({
        status: 200,
        description: 'Envio aceito para processamento',
        type: OrderResponseDto,
    })
    @ApiResponse({
        status: 400,
        description: 'Não foi possível enviar o pedido (status inválido)',
        schema: {
            example: {
                statusCode: 400,
                message: 'Cannot ship order in current status',
            },
        },
    })
    async shipOrder(@Param('id') id: string) {
        try {
            this.orderServiceEvents.emit('order.ship', id);
            return { status: 'accepted', message: 'Ship order request accepted' };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new HttpException(message || 'Failed to ship order', HttpStatus.BAD_REQUEST);
        }
    }

    @Patch(':id/deliver')
    @ApiOperation({
        summary: 'Entregar pedido',
        description: 'Muda o status do pedido de SHIPPED para DELIVERED (assíncrono)',
    })
    @ApiParam({
        name: 'id',
        description: 'ID do pedido a ser entregue',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    @ApiResponse({
        status: 200,
        description: 'Entrega aceita para processamento',
        type: OrderResponseDto,
    })
    @ApiResponse({
        status: 400,
        description: 'Não foi possível marcar como entregue (status inválido)',
        schema: {
            example: {
                statusCode: 400,
                message: 'Cannot deliver order in current status',
            },
        },
    })
    async deliverOrder(@Param('id') id: string) {
        try {
            this.orderServiceEvents.emit('order.deliver', id);
            return { status: 'accepted', message: 'Deliver order request accepted' };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new HttpException(message || 'Failed to deliver order', HttpStatus.BAD_REQUEST);
        }
    }

    @Patch(':id/cancel')
    @ApiOperation({
        summary: 'Cancelar pedido',
        description: 'Cancela um pedido, mudando seu status para CANCELLED (assíncrono)',
    })
    @ApiParam({
        name: 'id',
        description: 'ID do pedido a ser cancelado',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    @ApiResponse({
        status: 200,
        description: 'Cancelamento aceito para processamento',
        type: OrderResponseDto,
    })
    @ApiResponse({
        status: 400,
        description: 'Não foi possível cancelar o pedido',
        schema: {
            example: {
                statusCode: 400,
                message: 'Cannot cancel order',
            },
        },
    })
    async cancelOrder(@Param('id') id: string) {
        try {
            this.orderServiceEvents.emit('order.cancel', id);
            return { status: 'accepted', message: 'Cancel order request accepted' };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new HttpException(message || 'Failed to cancel order', HttpStatus.BAD_REQUEST);
        }
    }

    // ==================== QUERIES (Síncrono via HTTP) ====================

    @Get(':id')
    @ApiOperation({
        summary: 'Buscar pedido por ID',
        description: 'Retorna os dados completos de um pedido específico (síncrono via HTTP)',
    })
    @ApiParam({
        name: 'id',
        description: 'ID único do pedido',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    @ApiResponse({
        status: 200,
        description: 'Pedido encontrado',
        type: OrderResponseDto,
    })
    @ApiResponse({
        status: 404,
        description: 'Pedido não encontrado',
        schema: {
            example: {
                statusCode: 404,
                message: 'Order not found',
            },
        },
    })
    async getOrder(@Param('id') id: string) {
        try {
            // ✅ Síncrono: HTTP direto
            const response = await firstValueFrom(
                this.httpService.get<OrderResponseDto>(`${this.orderServiceUrl}/orders/${id}`)
            );
            return response.data;
        } catch (error: any) {
            if (error.response?.status === 404) {
                throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
            }
            const message = error.response?.data?.message || error.message || 'Failed to fetch order';
            throw new HttpException(message, error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get('user/:userId')
    @ApiOperation({
        summary: 'Buscar pedidos por usuário',
        description: 'Retorna todos os pedidos de um usuário específico (síncrono via HTTP)',
    })
    @ApiParam({
        name: 'userId',
        description: 'ID do usuário',
        example: '550e8400-e29b-41d4-a716-446655440001',
    })
    @ApiResponse({
        status: 200,
        description: 'Lista de pedidos retornada',
        type: [OrderResponseDto],
    })
    @ApiResponse({
        status: 500,
        description: 'Erro ao buscar pedidos',
    })
    async getOrdersByUser(@Param('userId') userId: string) {
        try {
            // ✅ Síncrono: HTTP direto
            const response = await firstValueFrom(
                this.httpService.get<OrderResponseDto[]>(`${this.orderServiceUrl}/orders/user/${userId}`)
            );
            return response.data;
        } catch (error: any) {
            const message = error.response?.data?.message || error.message || 'Failed to fetch orders';
            throw new HttpException(message, error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get()
    @ApiOperation({
        summary: 'Listar todos os pedidos',
        description: 'Retorna uma lista com todos os pedidos do sistema (síncrono via HTTP)',
    })
    @ApiResponse({
        status: 200,
        description: 'Lista de pedidos retornada com sucesso',
        type: [OrderResponseDto],
    })
    @ApiResponse({
        status: 500,
        description: 'Erro interno ao buscar pedidos',
    })
    async getAllOrders() {
        try {
            // ✅ Síncrono: HTTP direto
            const response = await firstValueFrom(
                this.httpService.get<OrderResponseDto[]>(`${this.orderServiceUrl}/orders`)
            );
            return response.data;
        } catch (error: any) {
            const message = error.response?.data?.message || error.message || 'Failed to fetch orders';
            throw new HttpException(message, error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
