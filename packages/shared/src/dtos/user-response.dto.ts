import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
    @ApiProperty({
        description: 'ID único do usuário',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    id: string;

    @ApiProperty({
        description: 'Nome completo do usuário',
        example: 'João Silva',
    })
    name: string;

    @ApiProperty({
        description: 'Email do usuário',
        example: 'joao.silva@email.com',
        format: 'email',
    })
    email: string;

    @ApiProperty({
        description: 'Data de criação do usuário',
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
