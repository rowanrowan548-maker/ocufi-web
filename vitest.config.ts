import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/__tests__/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'tests/e2e/**'],
    css: false,
  },
});
