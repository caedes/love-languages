import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  base: './',
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    coverage: {
      provider: 'v8',
      thresholds: {
        statements: 90,
        branches: 80,
        functions: 88,
        lines: 92,
      },
      reporter: ['text', 'html'],
      include: ['src/**'],
      exclude: [
        'src/data/**',
        'src/styles/**',
        'src/main.jsx',
        'src/test/**',
        'src/**/*.test.{js,jsx}',
      ],
    },
  },
});
