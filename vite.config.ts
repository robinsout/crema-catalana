import { build, defineConfig, loadEnv, type Plugin } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { contentHash, manifestDefine, swManifest } from './scripts/lib/sw.ts';
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

// The service worker (BACKLOG I-6): sw/worker.ts built into <outDir>/sw.js as a classic script, with
// the manifest of this build (its code files and a hash of the content)
const serviceWorker = (): Plugin => {
  let files: string[] = [];
  let outDir = '';
  let root = '';
  let content = '';
  return {
    name: 'service-worker',
    apply: 'build',
    configResolved(c) { outDir = resolve(c.root, c.build.outDir); root = c.root; content = c.publicDir; },
    generateBundle(_, bundle) { files = Object.keys(bundle); },
    async closeBundle() {
      const { available } = JSON.parse(readFileSync(resolve(content, 'locales/index.json'), 'utf8')) as { available: string[] };
      const manifest = swManifest(files, contentHash(content), available);
      await build({
        configFile: false,
        root,
        logLevel: 'silent',
        publicDir: false,
        define: { __SW_MANIFEST__: manifestDefine(manifest) },
        build: {
          outDir,
          emptyOutDir: false,
          lib: { entry: resolve(root, 'sw/worker.ts'), formats: ['iife'], name: 'quadernSw', fileName: () => 'sw.js' },
        },
      });
    },
  };
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    // relative paths: the site works under any path (GitHub Pages serves it at /crema-catalana/)
    base: './',
    // course data, lessons and audio are fetched at runtime and copied to the site as is
    publicDir: 'content',
    // an empty VITE_COUNTER_URL (e2e) means no counting, and no counter in the policy
    plugins: [vue(), serviceWorker(), csp(env.VITE_SYNC_URL || DEFAULT_SYNC_URL, env.VITE_COUNTER_URL ?? DEFAULT_COUNTER_URL)],
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
