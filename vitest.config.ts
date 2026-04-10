import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: ['src/core/**'],
      exclude: ['src/**/*.test.ts']
    },
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist']
  }
});