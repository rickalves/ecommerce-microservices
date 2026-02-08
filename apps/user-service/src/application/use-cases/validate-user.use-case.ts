import { Inject, Injectable } from '@nestjs/common';
import { User } from '../../domain/entities/user.entity';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.interface';
import { PasswordService } from '../../domain/services/password.service';
import type { IUserRepository } from '../../domain/repositories/user.repository.interface';

@Injectable()
export class ValidateUserUseCase {
    constructor(
        @Inject(USER_REPOSITORY)
        private readonly userRepository: IUserRepository,
        private readonly passwordService: PasswordService
    ) {}

    async execute(email: string, password: string): Promise<User | null> {
        const user = await this.userRepository.findByEmail(email);

        if (!user) {
            return null;
        }

        // Check if password is still in plain text (legacy users)
        if (!this.passwordService.isHashed(user.password)) {
            // Plain text password - direct comparison (insecure but handles existing users)
            if (user.password === password) {
                // Hash the password and update the user (migration on login)
                const hashedPassword = await this.passwordService.hash(password);
                user.password = hashedPassword;
                await this.userRepository.save(user);
                return user;
            }
            return null;
        }

        // Hashed password - use bcrypt comparison
        const isValid = await this.passwordService.compare(password, user.password);
        return isValid ? user : null;
    }
}
