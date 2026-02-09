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
import { StringValue } from 'ms';

type UserWithPassword = UserResponseDto & { password?: string };

@Injectable()
export class AuthService {
    constructor(
        @Inject('USER_SERVICE') private readonly userService: ClientProxy,
        private readonly jwtService: JwtService
    ) {}

    async login(loginDto: LoginDto): Promise<AuthResponseDto> {
        // Validate user credentials via user-service
        const user = await firstValueFrom(
            this.userService.send<UserWithPassword, LoginDto>({ cmd: 'validate_user' }, loginDto)
        );

        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        // Generate tokens with different payloads
        const accessPayload: IJwtPayload = {
            sub: user.id,
            email: user.email,
        };

        const refreshPayload = {
            sub: user.id,
            type: 'refresh',
        };

        const accessToken = await this.jwtService.signAsync(accessPayload, {
            expiresIn: jwtConfig.accessTokenExpiration as StringValue,
        });

        const refreshToken = await this.jwtService.signAsync(refreshPayload, {
            secret: jwtConfig.refreshSecret,
            expiresIn: jwtConfig.refreshTokenExpiration as StringValue,
        });

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
            this.userService.send<UserWithPassword, CreateUserDto>({ cmd: 'create_user' }, createUserDto)
        );

        // Generate tokens with different payloads
        const accessPayload: IJwtPayload = {
            sub: user.id,
            email: user.email,
        };

        const refreshPayload = {
            sub: user.id,
            type: 'refresh',
        };

        const accessToken = await this.jwtService.signAsync(accessPayload, {
            expiresIn: jwtConfig.accessTokenExpiration as StringValue,
        });

        const refreshToken = await this.jwtService.signAsync(refreshPayload, {
            secret: jwtConfig.refreshSecret,
            expiresIn: jwtConfig.refreshTokenExpiration as StringValue,
        });

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
            const payload = this.jwtService.verify<IJwtPayload & { type?: string }>(refreshToken, {
                secret: jwtConfig.refreshSecret,
            });

            // Validate that this is actually a refresh token
            if (payload.type !== 'refresh') {
                throw new UnauthorizedException('Invalid token type');
            }

            // Fetch fresh user data
            const user = await firstValueFrom(
                this.userService.send<UserWithPassword, string>({ cmd: 'get_user' }, payload.sub)
            );

            if (!user) {
                throw new UnauthorizedException('User not found');
            }

            // Generate new tokens with different payloads
            const newAccessPayload: IJwtPayload = {
                sub: user.id,
                email: user.email,
            };

            const newRefreshPayload = {
                sub: user.id,
                type: 'refresh',
            };

            const newAccessToken = await this.jwtService.signAsync(newAccessPayload, {
                expiresIn: jwtConfig.accessTokenExpiration as StringValue,
            });

            const newRefreshToken = await this.jwtService.signAsync(newRefreshPayload, {
                secret: jwtConfig.refreshSecret,
                expiresIn: jwtConfig.refreshTokenExpiration as StringValue,
            });

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
