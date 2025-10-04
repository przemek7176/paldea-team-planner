import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import singlefile from 'vite-plugin-singlefile';

export default defineConfig(({ mode }) => {
  // single-file when: --mode single OR env SINGLE_FILE=1
  const isSingle = mode === 'single' || process.env.SINGLE_FILE === '1';

  return {
    // For GitHub Pages (multi-file) use the repo subpath as base.
    // Single-file build has everything in index.html, so base can be empty.
    base: isSingle ? '' : '/paldea-team-planner/',
    plugins: [react(), ...(isSingle ? [singlefile()] : [])],
    build: isSingle
      ? {
          assetsInlineLimit: 100_000_000,
          cssCodeSplit: false,
          rollupOptions: {
            output: {
              inlineDynamicImports: true,
              manualChunks: undefined
            }
          }
        }
      : {}
  };
});
