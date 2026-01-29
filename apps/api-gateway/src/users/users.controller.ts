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
import { CreateUserDto } from '@ecommerce/shared';
import { firstValueFrom } from 'rxjs';

@Controller('users')
export class UsersController {
  constructor(@Inject('USER_SERVICE') private readonly userService: ClientProxy) {}

  @Post()
  async createUser(@Body() createUserDto: CreateUserDto) {
    try {
      return await firstValueFrom(this.userService.send({ cmd: 'create_user' }, createUserDto));
    } catch (error) {
      throw new HttpException(error.message || 'Failed to create user', HttpStatus.BAD_REQUEST);
    }
  }

  @Get(':id')
  async getUser(@Param('id') id: string) {
    try {
      return await firstValueFrom(this.userService.send({ cmd: 'get_user' }, id));
    } catch (error) {
      throw new HttpException(error.message || 'User not found', HttpStatus.NOT_FOUND);
    }
  }

  @Get()
  async getAllUsers() {
    try {
      return await firstValueFrom(this.userService.send({ cmd: 'get_all_users' }, {}));
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch users',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
