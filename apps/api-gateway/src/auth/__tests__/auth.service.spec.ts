import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';

const userServiceMock = {
    send: jest.fn(),
};

const jwtServiceMock = {
    signAsync: jest.fn(),
};

const makeUserResponse = () => ({
    id: 'user-1',
    name: 'João Silva',
    email: 'joao@example.com',
    password: '$2b$10$hash',
    createdAt: new Date(),
    updatedAt: new Date(),
});

// firstValueFrom precisa de um Observable — mock com rxjs
jest.mock('rxjs', () => ({
    ...jest.requireActual('rxjs'),
    firstValueFrom: jest.fn(),
}));

import { firstValueFrom } from 'rxjs';

describe('AuthService', () => {
    let service: AuthService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new AuthService(userServiceMock as any, jwtServiceMock as any);
    });

    describe('login', () => {
        it('deve retornar accessToken, refreshToken e dados do usuário sem senha', async () => {
            const userResponse = makeUserResponse();
            (firstValueFrom as jest.Mock).mockResolvedValue(userResponse);
            jwtServiceMock.signAsync
                .mockResolvedValueOnce('access-token-123')
                .mockResolvedValueOnce('refresh-token-456');

            const result = await service.login({ email: 'joao@example.com', password: 'senha123' });

            expect(firstValueFrom).toHaveBeenCalledTimes(1);
            expect(jwtServiceMock.signAsync).toHaveBeenCalledTimes(2);
            expect(result.accessToken).toBe('access-token-123');
            expect(result.refreshToken).toBe('refresh-token-456');
            expect(result.user.email).toBe('joao@example.com');
            expect((result.user as any).password).toBeUndefined();
        });

        it('deve lançar UnauthorizedException quando credenciais são inválidas', async () => {
            (firstValueFrom as jest.Mock).mockResolvedValue(null);

            await expect(
                service.login({ email: 'joao@example.com', password: 'errada' })
            ).rejects.toThrow(UnauthorizedException);

            expect(jwtServiceMock.signAsync).not.toHaveBeenCalled();
        });
    });

    describe('register', () => {
        it('deve criar o usuário via user-service e retornar tokens sem senha', async () => {
            const userResponse = makeUserResponse();
            (firstValueFrom as jest.Mock).mockResolvedValue(userResponse);
            jwtServiceMock.signAsync
                .mockResolvedValueOnce('access-token-789')
                .mockResolvedValueOnce('refresh-token-000');

            const result = await service.register({
                name: 'João Silva',
                email: 'joao@example.com',
                password: 'senha123',
            });

            expect(result.accessToken).toBe('access-token-789');
            expect(result.refreshToken).toBe('refresh-token-000');
            expect((result.user as any).password).toBeUndefined();
        });
    });
});
