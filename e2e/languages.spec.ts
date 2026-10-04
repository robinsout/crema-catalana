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
