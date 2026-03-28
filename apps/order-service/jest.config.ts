import type { Config } from 'jest';

const config: Config = {
    moduleFileExtensions: ['js', 'json', 'ts'],
    rootDir: '.',
    testMatch: ['<rootDir>/src/**/*.spec.ts'],
    transform: {
        '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
    },
    moduleNameMapper: {
        '^@ecommerce/shared$': '<rootDir>/../../packages/shared/src/index.ts',
        '^@ecommerce/observability$': '<rootDir>/../../packages/observability/src/index.ts',
    },
    testEnvironment: 'node',
    coverageDirectory: './coverage',
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.module.ts',
        '!src/main.ts',
        '!src/tracing.ts',
        '!src/**/migrations/**',
        '!src/**/data-source.ts',
    ],
};

export default config;
