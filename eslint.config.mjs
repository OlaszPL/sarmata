import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
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
  tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
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
              message: 'Domena jest czysta: bez I/O i bez innych pakietów (ADR 0004).',
            },
          ],
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
              message: 'Serwisy wołają bazę tylko przez @sarmata/repositories (ADR 0004).',
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
              group: ['@sarmata/repositories', '@sarmata/repositories/*'],
              message: 'Frontend korzysta tylko z @sarmata/services (ADR 0004).',
            },
          ],
        },
      ],
    },
  },
  prettier,
]);
