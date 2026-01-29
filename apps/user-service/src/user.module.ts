import { Module } from '@nestjs/common';

import { UserController } from './presentation/controllers/user.controller';
import { CreateUserUseCase } from './application/use-cases/create-user.use-case';
import { GetUserUseCase } from './application/use-cases/get-user.use-case';
import { InMemoryUserRepository } from './infrastructure/repositories/in-memory-user.repository';
import { USER_REPOSITORY } from './domain/repositories/user.repository.interface';

@Module({
  controllers: [UserController],
  providers: [
    CreateUserUseCase,
    GetUserUseCase,
    {
      provide: USER_REPOSITORY,
      useClass: InMemoryUserRepository,
    },
  ],
})
export class UserModule {}
