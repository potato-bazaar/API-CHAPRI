import { defineConfig } from 'vitest/config';

// Default suite: unit tests, server tests and the solo golden trajectories. Browser tests live in tests/e2e and run
// with vitest.e2e.config.mjs (npm run test:e2e).
export default defineConfig({
  test: {
    include: ['tests/**/*.test.mjs'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    environment: 'node',
    testTimeout: 600000,
    hookTimeout: 120000,
  },
});
