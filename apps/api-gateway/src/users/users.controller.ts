import {
    Body,
    Controller,
    Get,
    Inject,
    Param,
    Post,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiParam,
    ApiBody,
    ApiBearerAuth,
} from '@nestjs/swagger';
import { CreateUserDto, UserResponseDto } from '@ecommerce/shared';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
export class UsersController {
    constructor(@Inject('USER_SERVICE') private readonly userService: ClientProxy) {}

    @Public()
    @Post()
    @ApiOperation({
        summary: 'Criar novo usuário',
        description: 'Cria um novo usuário no sistema com nome, email e senha',
    })
    @ApiBody({ type: CreateUserDto })
    @ApiResponse({
        status: 201,
        description: 'Usuário criado com sucesso',
        type: UserResponseDto,
    })
    @ApiResponse({
        status: 400,
        description: 'Dados inválidos ou email já existe',
        schema: {
            example: {
                statusCode: 400,
                message: 'Email already exists',
            },
        },
    })
    async createUser(@Body() createUserDto: CreateUserDto) {
        try {
            const created = await firstValueFrom(
                this.userService.send({ cmd: 'create_user' }, createUserDto)
            );
            return created;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new HttpException(message || 'Failed to create user', HttpStatus.BAD_REQUEST);
        }
    }

    @Get(':id')
    @ApiOperation({
        summary: 'Buscar usuário por ID',
        description: 'Retorna os dados de um usuário específico pelo seu ID',
    })
    @ApiParam({
        name: 'id',
        description: 'ID único do usuário',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    @ApiResponse({
        status: 200,
        description: 'Usuário encontrado',
        type: UserResponseDto,
    })
    @ApiResponse({
        status: 404,
        description: 'Usuário não encontrado',
        schema: {
            example: {
                statusCode: 404,
                message: 'User not found',
            },
        },
    })
    async getUser(@Param('id') id: string) {
        try {
            const user = await firstValueFrom(this.userService.send({ cmd: 'get_user' }, id));
            if (!user) {
                throw new HttpException('User not found', HttpStatus.NOT_FOUND);
            }
            return user;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new HttpException(message || 'User not found', HttpStatus.NOT_FOUND);
        }
    }

    @Get()
    @ApiOperation({
        summary: 'Listar todos os usuários',
        description: 'Retorna uma lista com todos os usuários cadastrados no sistema',
    })
    @ApiResponse({
        status: 200,
        description: 'Lista de usuários retornada com sucesso',
        type: [UserResponseDto],
    })
    @ApiResponse({
        status: 500,
        description: 'Erro interno ao buscar usuários',
    })
    async getAllUsers() {
        try {
            const users = await firstValueFrom(this.userService.send({ cmd: 'get_all_users' }, {}));
            return users;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new HttpException(
                message || 'Failed to fetch users',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }
}
