import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserController } from './presentation/controllers/user.controller';
import { CreateUserUseCase } from './application/use-cases/create-user.use-case';
import { GetUserUseCase } from './application/use-cases/get-user.use-case';
import { TypeOrmUserRepository } from './infrastructure/database/repositories/typeorm-user.repository';
import { USER_REPOSITORY } from './domain/repositories/user.repository.interface';
import { UserEntity } from './infrastructure/database/entities/user.entity';

@Module({
    imports: [TypeOrmModule.forFeature([UserEntity])],
    controllers: [UserController],
    providers: [
        CreateUserUseCase,
        GetUserUseCase,
        {
            provide: USER_REPOSITORY,
            useClass: TypeOrmUserRepository,
        },
    ],
})
export class UserModule {}
