/**
 * Schemes-repo ESLint flat configuration.
 *
 * The published artifact is compiled scheme JSON plus the small library in
 * src/ that exports it, so the lint surface is every piece of executable code
 * in the repo: the library entry points in src/, the build/validate scripts in
 * scripts/, and the vitest specs. Scheme YAML/JSON sources are canonical
 * serializations owned by the `fmt` verb and are never linted or formatted
 * here.
 *
 * Run from the repo root: npx eslint .
 */

import js from '@eslint/js';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
    // Global ignores: dependencies, build output, and scheme data.
    {
        ignores: ['node_modules/**', 'dist/**', 'scheme-folder/**', '**/*.d.ts'],
    },

    // Node ESM scripts (build, validate, fmt, CI helpers).
    {
        files: ['scripts/**/*.mjs', 'eslint.config.mjs'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: globals.node,
        },
        rules: {
            ...js.configs.recommended.rules,
            'no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],
        },
    },

    // TypeScript library sources, specs, and config: parser + recommended
    // rules.
    {
        files: ['**/*.ts'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
            },
            // Vitest runs with globals: true (see vitest.config.ts), so the
            // spec files use describe/it/expect without imports.
            globals: {
                ...globals.node,
                ...globals.vitest,
            },
        },
        plugins: {
            '@typescript-eslint': tsPlugin,
        },
        rules: {
            ...tsPlugin.configs['recommended'].rules,
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],
        },
    },
];
