import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(({ mode }) => {
  // flip single-file when either flag is present
  const isSingle = mode === 'single' || process.env.SINGLE_FILE === '1';

  // helpful log (shows in CI logs)
  // eslint-disable-next-line no-console
  console.log(`[vite-config] mode=${mode} SINGLE_FILE=${process.env.SINGLE_FILE ?? ''} isSingle=${isSingle}`);

  const plugins = [react()];
  if (isSingle) plugins.push(viteSingleFile());

  return {
    // Multi-file (Pages) needs the repo subpath; single-file doesn't.
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
