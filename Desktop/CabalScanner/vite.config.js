import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3847',
      '/webhook': 'http://localhost:3847',
    },
  },
  build: {
    outDir: 'dist',
  },
});
