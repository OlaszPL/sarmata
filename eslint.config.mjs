import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
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
    files: ['backend/domain/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
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
    files: ['frontend/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@sarmata/repositories',
                '@sarmata/repositories/*',
                '@sarmata/ai',
                '@sarmata/ai/*',
                '@sarmata/worker',
                '@sarmata/worker/*',
                '@supabase/supabase-js',
              ],
              message: 'The frontend uses only @sarmata/services (ADR 0004).',
            },
            {
              group: ['**/backend/repositories/**', '**/backend/ai/**', '**/backend/worker/**'],
              message:
                'The frontend must not reach into the data layer by relative path (ADR 0004).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['backend/regulations/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
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
  prettier,
]);
