import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crownServiceWorker, crownBuildInfo } from './scripts/vite-plugin-sw';

export default defineConfig({
  base: './',
  // Build identity for Settings → About, update notices and window.__crownBuild (same data as dist/version.json).
  define: { __BUILD__: JSON.stringify(crownBuildInfo()) },
  plugins: [react(), crownServiceWorker()],
  worker: { format: 'es' },
  build: { target: 'es2022', sourcemap: true, chunkSizeWarningLimit: 900 },
  server: { host: true },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 60_000,
  },
} as never);
