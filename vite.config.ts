import { defineConfig, loadEnv, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import { contentSecurityPolicy } from './scripts/lib/csp.ts';
import { DEFAULT_SYNC_URL } from './shared/sync-api.ts';
import { DEFAULT_COUNTER_URL } from './shared/counter-api.ts';

// Puts the Content-Security-Policy into the built page (the dev server needs inline scripts for hot reload).
const csp = (syncUrl: string, counterUrl: string): Plugin => ({
  name: 'content-security-policy',
  apply: 'build',
  transformIndexHtml: () => [{
    tag: 'meta',
    attrs: { 'http-equiv': 'Content-Security-Policy', content: contentSecurityPolicy(syncUrl, counterUrl) },
    injectTo: 'head-prepend',
  }],
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    // relative paths: the site works under any path (GitHub Pages serves it at /crema-catalana/)
    base: './',
    // course data, lessons and audio are fetched at runtime and copied to the site as is
    publicDir: 'content',
    // an empty VITE_COUNTER_URL (e2e) means no counting, and no counter in the policy
    plugins: [vue(), csp(env.VITE_SYNC_URL || DEFAULT_SYNC_URL, env.VITE_COUNTER_URL ?? DEFAULT_COUNTER_URL)],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      // fonts stay files: the policy allows fonts only from the site, not from data: URLs
      assetsInlineLimit: (file: string) => (/\.woff2?$/.test(file) ? false : undefined),
    },
    test: {
      environment: 'happy-dom',
      include: ['tests/**/*.test.ts'],
    },
  };
});
