import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import singlefile from 'vite-plugin-singlefile';

export default defineConfig(({ mode }) => {
  const isSingle = mode === 'single' || process.env.SINGLE_FILE === '1';

  return {
    // Fix GitHub Pages asset paths (multi-file build)
    // Example site: https://<owner>.github.io/paldea-team-planner/
    base: isSingle ? '' : '/paldea-team-planner/',

    plugins: [react(), ...(isSingle ? [singlefile()] : [])],

    build: isSingle
      ? {
          // force everything into index.html
          assetsInlineLimit: 100_000_000,
          cssCodeSplit: false,
          rollupOptions: {
            output: {
              inlineDynamicImports: true,
              manualChunks: undefined,
            },
          },
        }
      : {},
  };
});
