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

test.describe('a Spanish browser (Latin America)', () => {
  test.use({ locale: 'es-CO' });

  test('a first visit opens the Spanish plan', async ({ page }) => {
    await page.goto('./');
    await expect(page).toHaveURL(/#\/es\/plan$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  });
});

test('the switcher opens the same lesson in English and remembers the choice', async ({ page, isMobile }) => {
  await page.goto('./#/ru/lesson/intro');
  if (isMobile) await page.locator('button[aria-controls="nav"]').click();
  await page.locator('select.lang-select').selectOption('en');
  await expect(page).toHaveURL(/#\/en\/lesson\/intro$/);
  await expect(page.locator('#fonetica h2')).toHaveText('1. Sounds');
  // the menu stays where it was, now in English
  await expect(page.locator('#nav .plan-link .t')).toBeVisible();
  await expect(page.locator('#nav .plan-link .t')).toHaveText('Study plan');
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

test('phones: the switcher stays under the finger while the lesson reloads in the other language', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'the menu is for narrow screens');
  await page.goto('./#/ru/lesson/x-temps-verbals');
  await page.locator('button[aria-controls="nav"]').click();
  const select = page.locator('select.lang-select');
  await select.scrollIntoViewIfNeeded();
  const before = (await select.boundingBox())!.y;
  await select.selectOption('en');
  await expect(page.locator('#nav .nav-chapters a').first()).toHaveText(/The map of tenses/);
  expect(Math.abs((await select.boundingBox())!.y - before)).toBeLessThan(3);
});
