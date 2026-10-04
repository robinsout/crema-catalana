// Languages of explanations in a real browser: the first visit follows the browser language,
// the switcher opens the same page in another language and is remembered.
import { test, expect } from './fixtures.ts';

test.describe('an English browser', () => {
  test.use({ locale: 'en-GB' });

  test('a first visit opens the English plan', async ({ page }) => {
    await page.goto('./');
    await expect(page).toHaveURL(/#\/en\/plan$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('.lesson-head h2')).toContainText('Passos 1');
  });

  test('a reader with progress from before the languages stays in Russian', async ({ page }) => {
    await page.goto('./#/ru/plan');
    await page.evaluate(() => localStorage.setItem('quadern-catala', JSON.stringify({ done: { intro: true }, last: 'pla' })));
    await page.goto('./');
    await expect(page).toHaveURL(/#\/ru\/plan$/);
  });
});

test('the switcher opens the same lesson in English and remembers the choice', async ({ page, isMobile }) => {
  await page.goto('./#/ru/lesson/intro');
  if (isMobile) await page.locator('button[aria-controls="nav"]').click();
  await page.locator('select.lang-select').selectOption('en');
  await expect(page).toHaveURL(/#\/en\/lesson\/intro$/);
  await expect(page.locator('#fonetica h2')).toHaveText('1. Sounds');
  await page.goto('./');
  await expect(page).toHaveURL(/#\/en\/lesson\/intro$/);
});

// iOS opens a native menu for a <select>, often above it, right over the sync link; the tap that
// picks an option can also reach the page underneath ("ghost click") and open the sync page.
test('a tap that lands right after switching the language does not open another page', async ({ page, isMobile }) => {
  // a phone network: the other language takes a moment to load, the menu stays open meanwhile
  await page.route('**/locales/en/**', async (route) => { await new Promise((r) => setTimeout(r, 400)); await route.continue(); });
  await page.goto('./#/ru/lesson/intro');
  if (isMobile) await page.locator('button[aria-controls="nav"]').click();
  const sync = await page.locator('.sync-link').boundingBox();
  await page.locator('select.lang-select').selectOption('en');
  await page.mouse.click(sync!.x + 20, sync!.y + sync!.height / 2);
  await page.waitForTimeout(800);
  await expect(page).toHaveURL(/#\/en\/lesson\/intro$/);
});
