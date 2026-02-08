import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
    @ApiProperty({
        description: 'Email do usuário',
        example: 'joao.silva@email.com',
        format: 'email',
    })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({
        description: 'Senha do usuário',
        example: 'senha123',
    })
    @IsString()
    @IsNotEmpty()
    password: string;
}
