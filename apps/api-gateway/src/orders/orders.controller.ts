import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Patch,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { CreateOrderDto } from '@ecommerce/shared';
import { firstValueFrom } from 'rxjs';

@Controller('orders')
export class OrdersController {
  constructor(@Inject('ORDER_SERVICE') private readonly orderService: ClientProxy) {}

  @Post()
  async createOrder(@Body() createOrderDto: CreateOrderDto) {
    try {
      return await firstValueFrom(this.orderService.send({ cmd: 'create_order' }, createOrderDto));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new HttpException(message || 'Failed to create order', HttpStatus.BAD_REQUEST);
    }
  }

  @Get(':id')
  async getOrder(@Param('id') id: string) {
    try {
      return await firstValueFrom(this.orderService.send({ cmd: 'get_order' }, id));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new HttpException(message || 'Order not found', HttpStatus.NOT_FOUND);
    }
  }

  @Get('user/:userId')
  async getOrdersByUser(@Param('userId') userId: string) {
    try {
      return await firstValueFrom(this.orderService.send({ cmd: 'get_orders_by_user' }, userId));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new HttpException(message || 'Failed to fetch orders', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get()
  async getAllOrders() {
    try {
      return await firstValueFrom(this.orderService.send({ cmd: 'get_all_orders' }, {}));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new HttpException(message || 'Failed to fetch orders', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch(':id/confirm')
  async confirmOrder(@Param('id') id: string) {
    try {
      return await firstValueFrom(this.orderService.send({ cmd: 'confirm_order' }, id));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new HttpException(message || 'Failed to confirm order', HttpStatus.BAD_REQUEST);
    }
  }

  @Patch(':id/ship')
  async shipOrder(@Param('id') id: string) {
    try {
      return await firstValueFrom(this.orderService.send({ cmd: 'ship_order' }, id));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new HttpException(message || 'Failed to ship order', HttpStatus.BAD_REQUEST);
    }
  }

  @Patch(':id/deliver')
  async deliverOrder(@Param('id') id: string) {
    try {
      return await firstValueFrom(this.orderService.send({ cmd: 'deliver_order' }, id));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new HttpException(message || 'Failed to deliver order', HttpStatus.BAD_REQUEST);
    }
  }

  @Patch(':id/cancel')
  async cancelOrder(@Param('id') id: string) {
    try {
      return await firstValueFrom(this.orderService.send({ cmd: 'cancel_order' }, id));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new HttpException(message || 'Failed to cancel order', HttpStatus.BAD_REQUEST);
    }
  }
}
