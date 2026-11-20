import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/',
  resolve: {
    alias: {
      // Gunakan bundle ESM browser resmi dari mqtt agar bebas polyfill Buffer/process di Vite.
      mqtt: path.resolve(__dirname, 'node_modules/mqtt/dist/mqtt.esm.js'),
    },
  },
});
