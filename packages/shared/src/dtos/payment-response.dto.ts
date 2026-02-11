import { ApiProperty } from '@nestjs/swagger';
import { PaymentStatus, PaymentMethod } from '../domain/payment.interface';

export class PaymentResponseDto {
    @ApiProperty({
        description: 'ID do pagamento',
        example: '550e8400-e29b-41d4-a716-446655440003',
    })
    id: string;

    @ApiProperty({
        description: 'ID do pedido associado',
        example: '550e8400-e29b-41d4-a716-446655440001',
    })
    orderId: string;

    @ApiProperty({
        description: 'ID do usuário',
        example: '550e8400-e29b-41d4-a716-446655440002',
    })
    userId: string;

    @ApiProperty({
        description: 'Valor do pagamento',
        example: 299.7,
    })
    amount: number;

    @ApiProperty({
        description: 'Status do pagamento',
        enum: PaymentStatus,
        example: PaymentStatus.COMPLETED,
    })
    status: PaymentStatus;

    @ApiProperty({
        description: 'Método de pagamento',
        enum: PaymentMethod,
        example: PaymentMethod.CREDIT_CARD,
    })
    method: PaymentMethod;

    @ApiProperty({
        description: 'ID da transação do gateway de pagamento',
        example: 'txn_abc123def456',
        required: false,
    })
    transactionId?: string;

    @ApiProperty({
        description: 'Data de criação',
        example: '2024-01-15T10:30:00Z',
    })
    createdAt: Date;

    @ApiProperty({
        description: 'Data de atualização',
        example: '2024-01-15T10:35:00Z',
    })
    updatedAt: Date;
}
