import { defineConfig } from 'vitest/config';

// DOMPurify (used by src/lib/validation.ts) needs a DOM, so tests run under jsdom.
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
});
