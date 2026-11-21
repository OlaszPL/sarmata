import { builtinModules } from 'node:module';
import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Only the worker, scripts and integration tests may create the service client: it bypasses RLS.
const serviceClientPath = {
  name: '@sarmata/repositories',
  importNames: ['createServiceClient'],
  message:
    'Only the worker, scripts and integration tests create the service client: it bypasses RLS (ADR 0004).',
};

// Node built-ins without the "node:" prefix are not caught by a "node:*" pattern.
const nodeBuiltinPaths = (message) => builtinModules.map((name) => ({ name, message }));

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    'infra/deploy/supabase/**',
    'infra/deploy/release/**',
    'database/src/types.ts',
    'frontend/ui/src/shadcn/**',
    '**/next-env.d.ts',
    'e2e/playwright-report/**',
    'e2e/test-results/**',
    '**/dist/**',
    '**/.next/**',
    '**/.turbo/**',
    'docs/**',
    'archive/**',
    '.agents/**',
    '.claude/**',
    '.codex/**',
    '.superpowers/**',
    '.termic/**',
  ]),
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Numbers in template literals are safe and common in date formatting.
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ['**/*.{ts,tsx}'],
    ignores: [
      'backend/worker/**',
      'backend/repositories/src/index.ts',
      '**/*.integration.test.ts',
      'scripts/**',
    ],
    rules: { 'no-restricted-imports': ['error', { paths: [serviceClientPath] }] },
  },
  {
    files: ['backend/domain/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: nodeBuiltinPaths('The domain is pure: no Node built-ins and no I/O (ADR 0004).'),
          patterns: [
            {
              group: ['@supabase/*', '@sarmata/*'],
              message: 'The domain is pure: no I/O and no other packages (ADR 0004).',
            },
            {
              group: ['node:*'],
              message: 'The domain is pure: no Node built-ins and no I/O (ADR 0004).',
            },
            {
              group: ['**/repositories/**', '**/services/**', '**/database/**'],
              message: 'The domain must not reach into other layers by relative path (ADR 0004).',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        {
          name: 'process',
          message: 'The domain is pure: no access to the process environment (ADR 0004).',
        },
      ],
    },
  },
  {
    files: ['backend/services/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [serviceClientPath],
          patterns: [
            {
              group: ['@supabase/*'],
              message: 'Services call the database only through @sarmata/repositories (ADR 0004).',
            },
          ],
        },
      ],
    },
  },
  {
    // The demo seed script signs in with a plain client, like a browser, and then uses the services.
    files: ['backend/services/src/seed-demo-evaluations.ts'],
    rules: { 'no-restricted-imports': ['error', { paths: [serviceClientPath] }] },
  },
  {
    files: ['frontend/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@sarmata/**',
                '!@sarmata/services',
                '!@sarmata/ui',
                '!@sarmata/ui/*',
                '!@sarmata/exports',
                '@supabase/*',
                '!@supabase/ssr',
              ],
              message:
                'The frontend uses only @sarmata/services, @sarmata/exports (download route), @sarmata/ui and @supabase/ssr (ADR 0004).',
            },
            {
              group: ['**/backend/**'],
              message: 'The frontend must not reach into the backend by relative path (ADR 0004).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['backend/regulations/**'],
    // The test of the legal source files reads them from disk.
    ignores: ['backend/regulations/src/sources.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: nodeBuiltinPaths(
            'Regulation versions are pure: no Node built-ins and no I/O (ADR 0006).',
          ),
          patterns: [
            {
              group: ['@supabase/*', '@sarmata/*', '!@sarmata/domain'],
              message: 'Regulation versions are data and pure code on @sarmata/domain (ADR 0006).',
            },
            {
              group: ['node:*'],
              message: 'Regulation versions are pure: no Node built-ins and no I/O (ADR 0006).',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        {
          name: 'process',
          message: 'Regulation versions are pure: no access to the process environment (ADR 0006).',
        },
      ],
    },
  },
  {
    files: ['frontend/**/*.{ts,tsx}'],
    plugins: { '@next/next': nextPlugin, 'react-hooks': reactHooks },
    settings: { next: { rootDir: 'frontend/web/' } },
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['frontend/ui/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@sarmata/*', '@supabase/*', 'next', 'next/*', '**/backend/**'],
              message: '@sarmata/ui is presentation only: no data, auth or Next.js imports.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['backend/ai/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@supabase/*', '@sarmata/*', '!@sarmata/domain'],
              message:
                'The AI client knows no database and no layer above the pure domain, services pass it data (ADR 0004).',
            },
          ],
        },
      ],
    },
  },
  prettier,
]);
