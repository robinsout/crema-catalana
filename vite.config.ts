import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  // relative paths: the site works under any path (GitHub Pages serves it at /crema-catalana/)
  base: './',
  // course data, lessons and audio are fetched at runtime and copied to the site as is
  publicDir: 'content',
  plugins: [vue()],
  build: { outDir: 'dist', emptyOutDir: true },
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
  },
});
