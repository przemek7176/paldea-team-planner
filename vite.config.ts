import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(({ mode }) => {
  // Single-file when: --mode single OR env SINGLE_FILE=1
  const isSingle = mode === 'single' || process.env.SINGLE_FILE === '1';

  const plugins = [react()];
  if (isSingle) plugins.push(viteSingleFile());

  return {
    // Multi-file build (Pages) needs repo subpath; single-file doesn't.
    base: isSingle ? '' : '/paldea-team-planner/',
    plugins,
    build: isSingle
      ? {
          // Inline everything into dist/index.html
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
