import js from '@eslint/js';
import prettierConfig from 'eslint-config-prettier/flat';
import importPlugin from 'eslint-plugin-import';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
    {
        ignores: [
            'dist',
            'design-system/storybook-static',
            'node_modules',
            '.wrangler',
            '.agents',
            '.claude',
            'worker-configuration.d.ts',
            'src/routeTree.gen.ts',
        ],
    },
    js.configs.recommended,
    tseslint.configs.recommended,
    prettierConfig,
    {
        files: ['**/*.{ts,tsx}'],
        rules: {
            'no-restricted-imports': [
                'error',
                { patterns: [{ regex: '^\\.\\./', message: 'Use ./ or an @ alias, never ../.' }] },
            ],
        },
    },
    {
        files: ['core/**/*.ts'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        { regex: '^\\.\\./', message: 'Use ./ or an @ alias, never ../.' },
                        {
                            regex: '^(react|react-dom|hono|use-intl|@tanstack/|cloudflare:)',
                            message: 'core imports nothing from React, Hono or Workers.',
                        },
                    ],
                },
            ],
        },
    },
    {
        files: ['src/**/*.{ts,tsx}', 'design-system/**/*.{ts,tsx}'],
        extends: [reactHooks.configs.flat.recommended],
        languageOptions: { globals: globals.browser },
    },
    {
        files: ['**/*.{ts,tsx}'],
        plugins: { import: importPlugin },
        settings: {
            'import/resolver': {
                typescript: { alwaysTryTypes: true },
                node: true,
            },
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'error',
            'import/order': [
                'error',
                {
                    groups: ['builtin', 'external', 'internal', ['parent', 'sibling'], 'index', 'object', 'type'],
                    'newlines-between': 'always',
                    alphabetize: { order: 'asc', caseInsensitive: true },
                },
            ],
            'import/no-restricted-paths': [
                'error',
                {
                    zones: [
                        {
                            target: './server',
                            from: './src',
                            message: 'The Worker cannot import from the SPA.',
                        },
                        {
                            target: './core',
                            from: ['./src', './server'],
                            message: 'core is shared logic and cannot import from the SPA or the Worker.',
                        },
                        {
                            target: ['./src', './core', './server'],
                            from: './design-system',
                            message: 'Nothing imports from the design system.',
                        },
                        {
                            target: './src/components',
                            from: './src/features',
                            message: 'Shared components cannot import from features.',
                        },
                        {
                            target: './src/lib',
                            from: './src/features',
                            message: 'Lib cannot import from features.',
                        },
                    ],
                },
            ],
        },
    },
]);
