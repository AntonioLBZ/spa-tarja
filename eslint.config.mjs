import js from '@eslint/js';
import prettierConfig from 'eslint-config-prettier/flat';
import { createNodeResolver, importX } from 'eslint-plugin-import-x';
import reactHooks from 'eslint-plugin-react-hooks';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
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
        plugins: { 'import-x': importX },
        settings: {
            'import-x/resolver-next': [createTypeScriptImportResolver({ alwaysTryTypes: true }), createNodeResolver()],
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'error',
            'import-x/order': [
                'error',
                {
                    groups: ['builtin', 'external', 'internal', ['parent', 'sibling'], 'index', 'object', 'type'],
                    'newlines-between': 'always',
                    alphabetize: { order: 'asc', caseInsensitive: true },
                },
            ],
            'import-x/no-restricted-paths': [
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
