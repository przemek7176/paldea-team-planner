import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Single-file build (used only by: npm run build:single)
export default defineConfig({
  base: '',                         // everything inlines into index.html
  plugins: [react(), viteSingleFile()],
  build: {
    assetsInlineLimit: 100_000_000, // inline all assets
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        manualChunks: undefined,
      },
    },
  },
});
