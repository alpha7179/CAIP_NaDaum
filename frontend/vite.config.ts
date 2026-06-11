// Vite 빌드 및 개발 서버 설정 (프록시, 테스트 환경 포함)
/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const backend = process.env.VITE_BACKEND_URL ?? 'http://localhost:3000';
const apiProxy = { target: backend, changeOrigin: true };

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/auth': apiProxy,
      '/me': apiProxy,
      '/sessions': apiProxy,
      '/diaries': apiProxy,
      '/admin': apiProxy,
      '/models': apiProxy,
      '/resources': apiProxy,
      '/integrations': apiProxy,
      '/openapi.json': apiProxy,
      '/health': apiProxy,
      '/sse': apiProxy,
      '/ws': { target: backend, ws: true, changeOrigin: true },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    passWithNoTests: true,
  },
});
