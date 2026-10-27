import fs from 'node:fs';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

const stubs = path.resolve(__dirname, 'src/test/__mocks__');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@so360/shell-context': path.join(stubs, 'shell-context.ts'),
      '@so360/cross-link': path.join(stubs, 'cross-link.ts'),
      '@so360/design-system': path.join(stubs, 'design-system.ts'),
      '@so360/formatters': path.join(stubs, 'formatters.ts'),
      '@so360/event-bus': path.join(stubs, 'event-bus.ts'),
      '@ds-real': fs.existsSync(path.resolve(__dirname, '../../so360-shell-fe/packages/design-system/src'))
        ? path.resolve(__dirname, '../../so360-shell-fe/packages/design-system/src')
        // PR Gate / CI runners do not check out so360-shell-fe next to this repo; an
        // unresolved @ds-real import there stalls every spec that loads the DS mock.
        : path.resolve(__dirname, 'src/test/__mocks__/ds-real'),
      'lucide-react': path.join(stubs, 'lucide-react.tsx'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    testTimeout: 15000,
    hookTimeout: 20000,
    teardownTimeout: 10000,
    reporters: ['default', path.resolve(__dirname, 'src/test/stallWatchdogReporter.ts')],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/**/*.d.ts', 'src/main.tsx', 'src/vite-env.d.ts', 'src/types/**'],
      thresholds: {
        branches: 60,
        functions: 70,
        lines: 70,
        statements: 70,
      },
    },
  },
});
