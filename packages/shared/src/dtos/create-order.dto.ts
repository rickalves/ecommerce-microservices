import { IsNotEmpty, IsString, IsArray, IsNumber, Min } from 'class-validator';

export class OrderItemDto {
    @IsString()
    @IsNotEmpty()
    productId: string;

    @IsNumber()
    @Min(1)
    quantity: number;

    @IsNumber()
    @Min(0)
    price: number;
}

export class CreateOrderDto {
    @IsString()
    @IsNotEmpty()
    userId: string;

    @IsArray()
    @IsNotEmpty()
    items: OrderItemDto[];
}
