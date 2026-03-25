import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserController } from './presentation/controllers/user.controller';
import { CreateUserUseCase } from './application/use-cases/create-user.use-case';
import { GetUserUseCase } from './application/use-cases/get-user.use-case';
import { ValidateUserUseCase } from './application/use-cases/validate-user.use-case';
import { TypeOrmUserRepository } from './infrastructure/database/repositories/typeorm-user.repository';
import { USER_REPOSITORY } from './domain/repositories/user.repository.interface';
import { UserEntity } from './infrastructure/database/entities/user.entity';
import { PasswordService } from './domain/services/password.service';

// Observability
import {
    LoggerModule,
    LoggerInterceptor,
    CorrelationModule,
    HealthModule,
    MetricsModule,
    MetricsInterceptor,
    TracingModule,
    TracingInterceptor,
} from '@ecommerce/observability';

@Module({
    imports: [
        // Observability modules
        LoggerModule.forRoot({ serviceName: 'user-service' }),
        CorrelationModule,
        HealthModule.forRoot({ database: true }),
        MetricsModule.forRoot({ serviceName: 'user-service' }),
        TracingModule,

        TypeOrmModule.forFeature([UserEntity]),
    ],
    controllers: [UserController],
    providers: [
        CreateUserUseCase,
        GetUserUseCase,
        ValidateUserUseCase,
        PasswordService,
        {
            provide: USER_REPOSITORY,
            useClass: TypeOrmUserRepository,
        },
        {
            provide: APP_INTERCEPTOR,
            useClass: LoggerInterceptor,
        },
        {
            provide: APP_INTERCEPTOR,
            useClass: MetricsInterceptor,
        },
        {
            provide: APP_INTERCEPTOR,
            useClass: TracingInterceptor,
        },
    ],
})
export class UserModule {}
