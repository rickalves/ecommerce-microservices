import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '../domain/order.interface';

export class OrderItemResponseDto {
    @ApiProperty({
        description: 'ID do produto',
        example: 'produto-123',
    })
    productId: string;

    @ApiProperty({
        description: 'Quantidade do produto',
        example: 2,
        minimum: 1,
    })
    quantity: number;

    @ApiProperty({
        description: 'Preço unitário do produto',
        example: 99.90,
        minimum: 0,
    })
    price: number;
}

export class OrderResponseDto {
    @ApiProperty({
        description: 'ID único do pedido',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    id: string;

    @ApiProperty({
        description: 'ID do usuário que criou o pedido',
        example: '550e8400-e29b-41d4-a716-446655440001',
    })
    userId: string;

    @ApiProperty({
        description: 'Lista de itens do pedido',
        type: [OrderItemResponseDto],
        example: [
            {
                productId: 'produto-123',
                quantity: 2,
                price: 99.90,
            },
            {
                productId: 'produto-456',
                quantity: 1,
                price: 149.90,
            },
        ],
    })
    items: OrderItemResponseDto[];

    @ApiProperty({
        description: 'Valor total do pedido',
        example: 349.70,
        minimum: 0,
    })
    totalAmount: number;

    @ApiProperty({
        description: 'Status atual do pedido',
        enum: OrderStatus,
        enumName: 'OrderStatus',
        example: OrderStatus.PENDING,
    })
    status: OrderStatus;

    @ApiProperty({
        description: 'Data de criação do pedido',
        example: '2024-01-15T10:30:00.000Z',
        type: 'string',
        format: 'date-time',
    })
    createdAt: Date;

    @ApiProperty({
        description: 'Data da última atualização',
        example: '2024-01-15T10:30:00.000Z',
        type: 'string',
        format: 'date-time',
    })
    updatedAt: Date;
}
