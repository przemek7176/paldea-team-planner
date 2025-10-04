import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Single-file artifact should be portable (double-click works), so use a relative base
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
  build: {
    target: 'esnext',
    // inline everything so index.html is standalone
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 1500
  }
})
