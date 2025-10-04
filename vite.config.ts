import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Auto-detect GitHub Pages base for this repo; "/" when served locally
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1] || ''
export default defineConfig({
  plugins: [react()],
  base: repo ? `/${repo}/` : '/',
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 1500,
  },
})
