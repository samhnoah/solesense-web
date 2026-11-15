import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Relative base + hash routing: the built site works under any path
// (GitHub Pages project sites, a USB stick, a kiosk) without changes.
export default defineConfig({
  base: './',
  plugins: [vue()],
})
