import { defineConfig, devices } from '@playwright/test';

// e2e tests run against the production build (vite preview).
// Functional tests run everywhere (locally and in CI). Screenshot tests are tagged @visual and run
// only locally (`npm run e2e:visual`): fonts render differently on macOS and Linux, so pixel
// baselines are made on the developer's machine.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173/',
    trace: 'retain-on-failure',
  },
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.001, animations: 'disabled' },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 }, launchOptions: { args: ['--mute-audio'] } } },
    { name: 'phone', use: { ...devices['iPhone 13'] } },
  ],
  webServer: [
    {
      // the site, built against the local sync server below
      command: 'VITE_SYNC_URL=http://localhost:8787 npm run build && npx vite preview --port 4173 --strictPort',
      url: 'http://localhost:4173/',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'node server/main.ts',
      url: 'http://localhost:8787/v1/health',
      env: { PORT: '8787', HOST: '127.0.0.1', DB_PATH: ':memory:', ALLOWED_ORIGINS: 'http://localhost:4173', RATE_PER_MINUTE: '10000' },
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
