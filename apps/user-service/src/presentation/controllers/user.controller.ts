import { Controller } from '@nestjs/common';
import { Payload, EventPattern, MessagePattern } from '@nestjs/microservices';
import { CreateUserDto, LoginDto } from '@ecommerce/shared';

import { CreateUserUseCase } from '../../application/use-cases/create-user.use-case';
import { GetUserUseCase } from '../../application/use-cases/get-user.use-case';
import { ValidateUserUseCase } from '../../application/use-cases/validate-user.use-case';

@Controller()
export class UserController {
    constructor(
        private readonly createUserUseCase: CreateUserUseCase,
        private readonly getUserUseCase: GetUserUseCase,
        private readonly validateUserUseCase: ValidateUserUseCase
    ) {}

    @EventPattern('user.create')
    async createUser(@Payload() createUserDto: CreateUserDto) {
        return this.createUserUseCase.execute(createUserDto);
    }

    @MessagePattern({ cmd: 'create_user' })
    async createUserCommand(@Payload() createUserDto: CreateUserDto) {
        return this.createUserUseCase.execute(createUserDto);
    }

    @EventPattern('user.get')
    async getUser(@Payload() userId: string) {
        return this.getUserUseCase.execute(userId);
    }

    @MessagePattern({ cmd: 'get_user' })
    async getUserCommand(@Payload() userId: string) {
        return this.getUserUseCase.execute(userId);
    }

    @EventPattern('user.get_all')
    async getAllUsers() {
        return this.getUserUseCase.getAllUsers();
    }

    @EventPattern('user.validate')
    async validateUser(@Payload() loginDto: LoginDto) {
        return this.validateUserUseCase.execute(loginDto.email, loginDto.password);
    }

    @MessagePattern({ cmd: 'validate_user' })
    async validateUserCommand(@Payload() loginDto: LoginDto) {
        return this.validateUserUseCase.execute(loginDto.email, loginDto.password);
    }
}
