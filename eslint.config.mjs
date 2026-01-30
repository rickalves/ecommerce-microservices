import parser from '@typescript-eslint/parser';
import plugin from '@typescript-eslint/eslint-plugin';

export default [
    {
        ignores: [
            'node_modules/**',
            'dist/**',
            'build/**',
            'coverage/**',
            '.vscode/**',
            '.DS_Store',
        ],
    },
    {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: {
            parser,
            parserOptions: { ecmaVersion: 2021, sourceType: 'module' },
        },
        plugins: { '@typescript-eslint': plugin },
        rules: {},
    },
];
