import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// @ts-ignore build-time assets
import {gardenResourcesPlugin} from '../scripts/garden-resource-build.mjs';

// iPad-first：host: true 让 iPad 能通过局域网访问 dev server
export default defineConfig({
  plugins: [gardenResourcesPlugin(), react()],
  cacheDir: fileURLToPath(new URL('./node_modules/.vite-play', import.meta.url)),
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        pinyinGarden: fileURLToPath(new URL('./experiments/pinyin-garden/index.html', import.meta.url)),
        rescue: fileURLToPath(new URL('./experiments/dino-rescue/index.html', import.meta.url)),
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@specs': fileURLToPath(new URL('../shared/specs', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3009',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', '../shared/src/**/*.test.ts'],
  },
});
