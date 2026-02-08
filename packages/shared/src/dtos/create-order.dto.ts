import { IsNotEmpty, IsString, IsArray, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class OrderItemDto {
    @ApiProperty({
        description: 'ID do produto',
        example: 'produto-123',
    })
    @IsString()
    @IsNotEmpty()
    productId: string;

    @ApiProperty({
        description: 'Quantidade do produto',
        example: 2,
        minimum: 1,
    })
    @IsNumber()
    @Min(1)
    quantity: number;

    @ApiProperty({
        description: 'Preço unitário do produto',
        example: 99.90,
        minimum: 0,
    })
    @IsNumber()
    @Min(0)
    price: number;
}

export class CreateOrderDto {
    @ApiProperty({
        description: 'ID do usuário que está criando o pedido',
        example: '550e8400-e29b-41d4-a716-446655440001',
    })
    @IsString()
    @IsNotEmpty()
    userId: string;

    @ApiProperty({
        description: 'Lista de itens do pedido',
        type: [OrderItemDto],
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
    @IsArray()
    @IsNotEmpty()
    items: OrderItemDto[];
}
