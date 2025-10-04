import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Normal Multi-file build (used by: npm run build, GitHub Pages)
export default defineConfig({
  base: '/paldea-team-planner/',   // required for Pages
  plugins: [react()],
});
