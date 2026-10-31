// The service worker in a real browser (BACKLOG I-6): a repeat visit comes from the cache, and the
// pages already opened work offline. Chromium only: WebKit of Playwright has no offline service workers.
import { test, expect, type Page } from './fixtures.ts';

test.use({ serviceWorkers: 'allow' });
test.skip(({ browserName }) => browserName !== 'chromium', 'service workers offline: Chromium');

// the first visit installs the worker; it takes over the page once installed
async function installed(page: Page): Promise<void> {
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
}

test('a repeat visit takes the page, code and course data from the cache', async ({ page }) => {
  await page.goto('./#/ru/plan');
  await installed(page);
  await page.goto('./#/ru/lesson/b1-01'); // read once: kept
  await expect(page.locator('article.lesson section').first()).toBeVisible();
  const fromWorker = new Map<string, boolean>();
  page.on('response', (r) => { fromWorker.set(new URL(r.url()).pathname, r.fromServiceWorker()); });
  await page.reload();
  await expect(page.locator('article.lesson section').first()).toBeVisible();
  for (const path of ['/', '/course.json', '/locales/ru/catalog.json', '/locales/ru/lessons/b1-01.html']) {
    expect(fromWorker.get(path), path).toBe(true);
  }
});

test('the plan and the lessons already opened work offline', async ({ page, context }) => {
  await page.goto('./#/ru/plan');
  await installed(page);
  await page.goto('./#/ru/lesson/b1-01');
  await expect(page.locator('article.lesson section').first()).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.lesson-head h2')).toHaveText('Hola, soc la Maria');
  await expect(page.locator('article.lesson section').first()).toBeVisible();
  await page.locator('a.plan-link').first().click();
  await expect(page.locator('.lesson-head h2')).toContainText('Passos 1');
  await context.setOffline(false);
});
