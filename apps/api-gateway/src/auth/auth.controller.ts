import { Body, Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { LoginDto, CreateUserDto, AuthResponseDto } from '@ecommerce/shared';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Public()
    @Post('login')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Login de usuário',
        description: 'Autentica um usuário e retorna tokens JWT',
    })
    @ApiBody({ type: LoginDto })
    @ApiResponse({
        status: 200,
        description: 'Login realizado com sucesso',
        type: AuthResponseDto,
    })
    @ApiResponse({
        status: 401,
        description: 'Credenciais inválidas',
    })
    async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
        return this.authService.login(loginDto);
    }

    @Public()
    @Post('register')
    @ApiOperation({
        summary: 'Registrar novo usuário',
        description: 'Cria um novo usuário e retorna tokens JWT',
    })
    @ApiBody({ type: CreateUserDto })
    @ApiResponse({
        status: 201,
        description: 'Usuário criado com sucesso',
        type: AuthResponseDto,
    })
    @ApiResponse({
        status: 400,
        description: 'Dados inválidos ou email já existe',
    })
    async register(@Body() createUserDto: CreateUserDto): Promise<AuthResponseDto> {
        return this.authService.register(createUserDto);
    }

    @Public()
    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Renovar token de acesso',
        description: 'Gera novos tokens usando o refresh token',
    })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                refreshToken: {
                    type: 'string',
                    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                },
            },
        },
    })
    @ApiResponse({
        status: 200,
        description: 'Token renovado com sucesso',
        type: AuthResponseDto,
    })
    @ApiResponse({
        status: 401,
        description: 'Refresh token inválido',
    })
    async refresh(@Body('refreshToken') refreshToken: string): Promise<AuthResponseDto> {
        return this.authService.refreshToken(refreshToken);
    }
}
