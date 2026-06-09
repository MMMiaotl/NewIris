import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiProxy = {
  '/request': { target: 'http://localhost:8082', changeOrigin: true },
  '/SmcServer1': { target: 'http://localhost:8082', changeOrigin: true },
  '/SmcServer2': { target: 'http://localhost:8082', changeOrigin: true },
  '/watchio': { target: 'http://localhost:8082', changeOrigin: true },
};

export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    port: 5173,
    proxy: apiProxy,
  },
  preview: {
    port: 5173,
    proxy: apiProxy,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
