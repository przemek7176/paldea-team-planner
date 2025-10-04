import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Only unit tests under src/**
    include: ['src/**/*.test.{ts,tsx}', 'src/**/*.spec.{ts,tsx}'],
    // Keep Playwright specs out of Vitest
    exclude: [
      'node_modules',
      'dist',
      '.idea',
      '.git',
      '.cache',
      'cypress',
      'tests/**',
    ],
    environment: 'node',
    globals: true, // Vitest provides describe/it/expect without touching tsconfig types
  },
});
