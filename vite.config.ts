import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Only run unit tests in src/**
    include: [
      'src/**/*.test.{ts,tsx}',
      'src/**/*.spec.{ts,tsx}',
    ],
    // Never touch Playwright specs
    exclude: [
      'node_modules',
      'dist',
      'tests/**',
      '**/tests/**',
      '**/*.pw.spec.*'
    ],
    environment: 'node',
    globals: true
  },
});
