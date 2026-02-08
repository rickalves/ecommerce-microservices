import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ClientsModule, Transport } from '@nestjs/microservices';

import { UsersController } from './users/users.controller';
import { OrdersController } from './orders/orders.controller';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

@Module({
    imports: [
        AuthModule,
        ClientsModule.register([
            {
                name: 'USER_SERVICE',
                transport: Transport.TCP,
                options: {
                    host: process.env.USER_SERVICE_HOST || 'user-service',
                    port: Number(process.env.USER_SERVICE_PORT || 3001),
                },
            },
            {
                name: 'ORDER_SERVICE',
                transport: Transport.TCP,
                options: {
                    host: process.env.ORDER_SERVICE_HOST || 'order-service',
                    port: Number(process.env.ORDER_SERVICE_PORT || 3002),
                },
            },
        ]),
    ],
    controllers: [UsersController, OrdersController],
    providers: [
        {
            provide: APP_GUARD,
            useClass: JwtAuthGuard,
        },
    ],
})
export class AppModule {}
