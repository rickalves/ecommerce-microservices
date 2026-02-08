import { Inject, Injectable } from '@nestjs/common';
import { CreateUserDto } from '@ecommerce/shared';

import { User } from '../../domain/entities/user.entity';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.interface';
import { PasswordService } from '../../domain/services/password.service';

import type { IUserRepository } from '../../domain/repositories/user.repository.interface';
@Injectable()
export class CreateUserUseCase {
    constructor(
        @Inject(USER_REPOSITORY)
        private readonly userRepository: IUserRepository,
        private readonly passwordService: PasswordService
    ) {}

    async execute(createUserDto: CreateUserDto): Promise<User> {
        const existingUser = await this.userRepository.findByEmail(createUserDto.email);

        if (existingUser) {
            throw new Error('User with this email already exists');
        }

        // Hash password before creating user
        const hashedPassword = await this.passwordService.hash(createUserDto.password);
        const user = User.create(createUserDto.name, createUserDto.email, hashedPassword);

        return this.userRepository.save(user);
    }
}
