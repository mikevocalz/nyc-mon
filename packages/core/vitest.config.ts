import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // The 10k-run determinism and long-horizon property suites are CPU-bound.
    testTimeout: 120_000,
  },
});
