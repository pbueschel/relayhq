import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

// GitHub Pages serves this project from /relayhq/. `base` must match or every
// asset 404s. Override with BASE=/ for local preview of the production build.
const base = process.env.BASE ?? '/relayhq/';

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    outDir: 'dist',
    // The prototype is one app; a single chunk keeps Pages simple and fast.
    chunkSizeWarningLimit: 1600,
  },
});
