import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser']
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@scenes': path.resolve(__dirname, './src/scenes'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@data': path.resolve(__dirname, './public/assets/data')
    }
  },
  server: {
    port: 3000,
    strictPort: false,   // ← если 3000 занят, попробует 3001
    host: '127.0.0.1',  // ← только localhost, не 0.0.0.0
    open: true           // ← автоматически откроет браузер
  }
});
