import js from '@eslint/js';
import prettier from 'eslint-config-prettier/flat';
import importPlugin from 'eslint-plugin-import';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import typescript from 'typescript-eslint';

/** @type {import('eslint').Linter.Config[]} */
export default [
    js.configs.recommended,
    reactHooks.configs.flat.recommended,
    ...typescript.configs.recommended,
    {
        ...react.configs.flat.recommended,
        ...react.configs.flat['jsx-runtime'], // Required for React 17+
        languageOptions: {
            globals: {
                ...globals.browser,
            },
        },
        rules: {
            'react/react-in-jsx-scope': 'off',
            'react/prop-types': 'off',
            'react/no-unescaped-entities': 'off',
        },
        settings: {
            react: {
                version: 'detect',
            },
        },
    },
    {
        ...importPlugin.flatConfigs.recommended,
        settings: {
            'import/resolver': {
                typescript: true,
                node: true,
            },
        },
        rules: {
            'import/order': [
                'error',
                {
                    groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
                    alphabetize: {
                        order: 'asc',
                        caseInsensitive: true,
                    },
                },
            ],
        },
    },
    {
        ...importPlugin.flatConfigs.typescript,
        files: ['**/*.{ts,tsx}'],
        rules: {
            '@typescript-eslint/consistent-type-imports': [
                'error',
                {
                    prefer: 'type-imports',
                    fixStyle: 'separate-type-imports',
                },
            ],
        },
    },
    {
        // Fase 0 del plan maestro DIALux (planes/plan_maestro_dialux_web_motor_arquitectura_validacion.md,
        // §4.1): el dominio geométrico/fotométrico/eléctrico no puede importar
        // React, Zustand, Axios, Babylon ni Inertia. Alcance deliberadamente
        // acotado a los archivos que YA son puro dominio hoy (verificado en
        // planes/fase0_inventario_dialux.md) — se amplía a `domain/` cuando la
        // Fase 2/7 mueva más archivos a esa carpeta, no antes.
        files: [
            'resources/js/pages/dialux/hooks/lightingEngineCore.ts',
            'resources/js/pages/dialux/hooks/roomLighting.ts',
            'resources/js/pages/dialux/hooks/lightingCalculations.ts',
            'resources/js/pages/dialux/domain/calculation/**/*.ts',
            'resources/js/pages/dialux/electrical/engine/**/*.ts',
            'resources/js/pages/dialux/geometry/**/*.ts',
            'resources/js/pages/dialux/selection/**/*.ts',
            'resources/js/pages/dialux/export/dxf/{domain,geometry,emitters,symbols,builders}/**/*.ts',
            'resources/js/pages/dialux/export/snapshot/**/*.ts',
            'resources/js/pages/dialux/export/domain/**/*.ts',
            'resources/js/pages/dialux/export/derived/geometry/**/*.ts',
        ],
        ignores: ['**/*.test.ts', '**/__fixtures__/**'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    paths: [
                        { name: 'react', message: 'El dominio DIALux no puede importar React (plan maestro §4.1).' },
                        { name: 'zustand', message: 'El dominio DIALux no puede importar Zustand (plan maestro §4.1).' },
                        { name: 'axios', message: 'El dominio DIALux no puede importar Axios (plan maestro §4.1).' },
                    ],
                    patterns: [
                        { group: ['@inertiajs/*'], message: 'El dominio DIALux no puede importar Inertia (plan maestro §4.1).' },
                        { group: ['babylonjs', '@babylonjs/*'], message: 'El dominio DIALux no puede importar Babylon (plan maestro §4.1).' },
                    ],
                },
            ],
            'no-restricted-globals': [
                'error',
                { name: 'document', message: 'El dominio DIALux no puede tocar el DOM (plan maestro §4.1).' },
                { name: 'window', message: 'El dominio DIALux no puede tocar window/DOM (plan maestro §4.1).' },
            ],
        },
    },
    {
        ignores: ['vendor', 'node_modules', 'public', 'bootstrap/ssr', 'tailwind.config.js', 'vite.config.ts'],
    },
    prettier, // Turn off all rules that might conflict with Prettier
];
