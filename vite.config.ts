import { resolve } from 'node:path'
import { defineConfig } from 'vite'

// Relative base: the built site works under any path (GitHub Pages project
// sites, a USB stick, an exhibition kiosk) without changes.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        test: resolve(import.meta.dirname, 'test.html'),
      },
    },
  },
})
