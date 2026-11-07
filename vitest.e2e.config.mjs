import { defineConfig } from 'vitest/config';

// Browser end-to-end tests: real room server, real built game, real Chromium (Playwright). One file at a time, because
// each test opens several WebGL pages and the machine has few cores.
export default defineConfig({
  test: {
    include: ['tests/e2e/**/*.e2e.test.mjs'],
    environment: 'node',
    fileParallelism: false,
    maxConcurrency: 1,
    testTimeout: 900000,
    hookTimeout: 300000,
  },
});
