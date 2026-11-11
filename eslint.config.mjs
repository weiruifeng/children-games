import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';
import a11y from 'eslint-plugin-jsx-a11y';
import globals from 'globals';

const sources = ['web/src/**/*.{ts,tsx}', 'shared/src/**/*.ts', 'server/src/**/*.ts'];

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      'web/dist-garden/**',
      '.workbench/**',
      '.runtime/**',
      'shared/src/pinyin-garden/data/**',
    ],
  },
  {
    files: ['**/*.{ts,tsx,mjs,cjs}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      ...js.configs.recommended.rules,
      // Prettier formats fluent computed method calls across lines; this is a formatting conflict.
      'no-unexpected-multiline': 'off',
    },
  },
  { ...tseslint.configs.recommended[0] },
  ...tseslint.configs.recommended
    .slice(1)
    .map((config) => ({ ...config, files: ['**/*.{ts,tsx}'] })),
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['**/*.d.ts'],
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { disallowTypeAnnotations: false }],
    },
  },
  {
    files: sources,
    ignores: ['**/*.test.ts'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['web/src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': hooks, 'jsx-a11y': a11y },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      ...a11y.configs.recommended.rules,
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/shared/src/**', '**/server/src/**'],
              message: 'Use the shared public package interface.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['server/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/shared/src/**', '**/web/src/**'],
              message: 'Use the shared public package interface.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['shared/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/web/**', '**/server/**'],
              message: 'Shared domain code cannot depend on an application.',
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      'web/src/site/api.ts',
      'web/src/site/repository.ts',
      'server/src/modules/garden-site/auth.service.ts',
      'server/src/modules/garden-site/garden.service.ts',
      'web/src/site/repositoryModels.ts',
      'web/src/site/backupImport.ts',
      'web/src/site/eventSync.ts',
      'web/src/experiments/pinyin-garden/services/gardenSession.ts',
      'web/src/experiments/pinyin-garden/services/saveCoordinator.ts',
      'server/src/http-errors.ts',
    ],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
    },
  },
);
