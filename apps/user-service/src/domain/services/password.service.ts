import * as bcrypt from 'bcrypt';
import { Injectable } from '@nestjs/common';

@Injectable()
export class PasswordService {
    private readonly saltRounds = 10;

    async hash(plainPassword: string): Promise<string> {
        return bcrypt.hash(plainPassword, this.saltRounds);
    }

    async compare(plainPassword: string, hashedPassword: string): Promise<boolean> {
        return bcrypt.compare(plainPassword, hashedPassword);
    }

    /**
     * Check if a password is already hashed (bcrypt hashes start with $2b$ or $2a$)
     */
    isHashed(password: string): boolean {
        return /^\$2[aby]\$/.test(password);
    }
}
