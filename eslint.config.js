import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import globals from 'globals';

export default [
  {
    ignores: ['dist/**', 'node_modules/**']
  },
  eslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module'
      },
      globals: {
        ...globals.node,
        ...globals.browser
      }
    },
    plugins: {
      '@typescript-eslint': tseslint
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': 'warn'
    }
  }
];