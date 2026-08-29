import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    // Relative asset paths so the Electron shell can load the build over file://.
    base: './',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      // Electron 43 bundles a modern Chromium — skip legacy-transform overhead.
      target: 'es2022',
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            markdown: ['react-markdown'],
            jszip: ['jszip'],
            motion: ['motion'],
            icons: ['lucide-react'],
          },
        },
      },
    },
  };
});
