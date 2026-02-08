import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import {
    LoginDto,
    AuthResponseDto,
    IJwtPayload,
    UserResponseDto,
    CreateUserDto,
} from '@ecommerce/shared';
import { jwtConfig } from '../config/jwt.config';

@Injectable()
export class AuthService {
    constructor(
        @Inject('USER_SERVICE') private readonly userService: ClientProxy,
        private readonly jwtService: JwtService
    ) {}

    async login(loginDto: LoginDto): Promise<AuthResponseDto> {
        // Validate user credentials via user-service
        const user = await firstValueFrom(
            this.userService.send({ cmd: 'validate_user' }, loginDto)
        );

        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        // Generate tokens
        const payload: IJwtPayload = {
            sub: user.id,
            email: user.email,
        };

        const accessToken = this.jwtService.sign(payload);

        const refreshToken = this.jwtService.sign(payload);

        // Remove password from response
        const { password, ...userResponse } = user;

        return {
            accessToken,
            refreshToken,
            user: userResponse as UserResponseDto,
        };
    }

    async register(createUserDto: CreateUserDto): Promise<AuthResponseDto> {
        // Create user via user-service
        const user = await firstValueFrom(
            this.userService.send({ cmd: 'create_user' }, createUserDto)
        );

        // Generate tokens
        const payload: IJwtPayload = {
            sub: user.id,
            email: user.email,
        };

        const accessToken = this.jwtService.sign(payload);

        const refreshToken = this.jwtService.sign(payload);

        // Remove password from response
        const { password, ...userResponse } = user;

        return {
            accessToken,
            refreshToken,
            user: userResponse as UserResponseDto,
        };
    }

    async refreshToken(refreshToken: string): Promise<AuthResponseDto> {
        try {
            const payload = this.jwtService.verify<IJwtPayload>(refreshToken, {
                secret: jwtConfig.secret,
            });

            // Fetch fresh user data
            const user = await firstValueFrom(
                this.userService.send({ cmd: 'get_user' }, payload.sub)
            );

            if (!user) {
                throw new UnauthorizedException('User not found');
            }

            // Generate new tokens
            const newPayload: IJwtPayload = {
                sub: user.id,
                email: user.email,
            };

            const newAccessToken = this.jwtService.sign(newPayload);

            const newRefreshToken = this.jwtService.sign(newPayload);

            const { password, ...userResponse } = user;

            return {
                accessToken: newAccessToken,
                refreshToken: newRefreshToken,
                user: userResponse as UserResponseDto,
            };
        } catch (error) {
            throw new UnauthorizedException('Invalid refresh token');
        }
    }
}
