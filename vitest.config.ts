import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Only run unit tests from src/**
    include: ['src/**/*.test.{ts,tsx}', 'src/**/*.spec.{ts,tsx}'],
    // Do NOT pick up Playwright specs
    exclude: [
      'node_modules',
      'dist',
      '.idea',
      '.git',
      '.cache',
      'cypress',
      'tests/**', // <— keep Playwright in its own runner
    ],
    environment: 'node',
  },
});
