import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile' // named export

export default defineConfig(({ mode }) => {
  const isSingle = mode === 'single'
  return {
    plugins: [
      react(),
      ...(isSingle ? [viteSingleFile()] : []),
    ],
    build: {
      target: 'es2018',
      cssCodeSplit: false,
      assetsInlineLimit: 100_000_000,
      sourcemap: !isSingle
      // NOTE: do not set rollupOptions.output.manualChunks in single mode
    }
  }
})
