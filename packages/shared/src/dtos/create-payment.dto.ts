import { IsNotEmpty, IsString, IsNumber, IsEnum, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod } from '../domain/payment.interface';

export class CreatePaymentDto {
    @ApiProperty({
        description: 'ID do pedido associado ao pagamento',
        example: '550e8400-e29b-41d4-a716-446655440001',
    })
    @IsString()
    @IsNotEmpty()
    orderId: string;

    @ApiProperty({
        description: 'ID do usuário que está realizando o pagamento',
        example: '550e8400-e29b-41d4-a716-446655440002',
    })
    @IsString()
    @IsNotEmpty()
    userId: string;

    @ApiProperty({
        description: 'Valor total do pagamento',
        example: 299.7,
        minimum: 0,
    })
    @IsNumber()
    @Min(0)
    amount: number;

    @ApiProperty({
        description: 'Método de pagamento',
        enum: PaymentMethod,
        example: PaymentMethod.CREDIT_CARD,
    })
    @IsEnum(PaymentMethod)
    @IsNotEmpty()
    method: PaymentMethod;
}
