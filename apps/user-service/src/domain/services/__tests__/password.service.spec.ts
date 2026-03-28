import { PasswordService } from '../password.service';

describe('PasswordService', () => {
    let service: PasswordService;

    beforeEach(() => {
        service = new PasswordService();
    });

    describe('isHashed', () => {
        it('deve retornar true para hash bcrypt $2b$', () => {
            expect(
                service.isHashed('$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy')
            ).toBe(true);
        });

        it('deve retornar true para hash bcrypt $2a$', () => {
            expect(
                service.isHashed('$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy')
            ).toBe(true);
        });

        it('deve retornar false para senha em texto plano', () => {
            expect(service.isHashed('minha_senha_123')).toBe(false);
        });

        it('deve retornar false para string vazia', () => {
            expect(service.isHashed('')).toBe(false);
        });
    });

    describe('hash', () => {
        it('deve retornar um hash bcrypt válido', async () => {
            const hash = await service.hash('minha_senha');

            expect(service.isHashed(hash)).toBe(true);
        });

        it('deve gerar hashes diferentes para a mesma senha (salt aleatório)', async () => {
            const hash1 = await service.hash('mesma_senha');
            const hash2 = await service.hash('mesma_senha');

            expect(hash1).not.toBe(hash2);
        });
    });

    describe('compare', () => {
        it('deve retornar true quando a senha plain bate com o hash', async () => {
            const plain = 'senha_correta';
            const hash = await service.hash(plain);

            const result = await service.compare(plain, hash);

            expect(result).toBe(true);
        });

        it('deve retornar false quando a senha plain não bate com o hash', async () => {
            const hash = await service.hash('senha_correta');

            const result = await service.compare('senha_errada', hash);

            expect(result).toBe(false);
        });
    });
});
