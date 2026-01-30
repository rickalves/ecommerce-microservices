import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';

import { UsersController } from './users/users.controller';
import { OrdersController } from './orders/orders.controller';

@Module({
    imports: [
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
})
export class AppModule {}
