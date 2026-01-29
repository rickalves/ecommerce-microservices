import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CreateUserDto } from '@ecommerce/shared';

import { CreateUserUseCase } from '../../application/use-cases/create-user.use-case';
import { GetUserUseCase } from '../../application/use-cases/get-user.use-case';

@Controller()
export class UserController {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly getUserUseCase: GetUserUseCase,
  ) {}

  @MessagePattern({ cmd: 'create_user' })
  async createUser(@Payload() createUserDto: CreateUserDto) {
    return this.createUserUseCase.execute(createUserDto);
  }

  @MessagePattern({ cmd: 'get_user' })
  async getUser(@Payload() userId: string) {
    return this.getUserUseCase.execute(userId);
  }

  @MessagePattern({ cmd: 'get_all_users' })
  async getAllUsers() {
    return this.getUserUseCase.getAllUsers();
  }
}
