import { Inject, Injectable } from '@nestjs/common';
import { CreateUserDto } from '@ecommerce/shared';

import { User } from '../../domain/entities/user.entity';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../domain/repositories/user.repository.interface';

@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(createUserDto: CreateUserDto): Promise<User> {
    const existingUser = await this.userRepository.findByEmail(createUserDto.email);

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    const user = User.create(createUserDto.name, createUserDto.email, createUserDto.password);

    return this.userRepository.save(user);
  }
}
