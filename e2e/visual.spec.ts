import { test, expect } from '@playwright/test';

// Screenshot comparisons: local only (npm run e2e:visual), see playwright.config.ts.
const pages = {
  plan: '#/ru/plan',
  'lesson-intro': '#/ru/lesson/intro',
  'lesson-tenses': '#/ru/lesson/x-temps-verbals',
  'lesson-numbers': '#/ru/lesson/x-nombres-calendari',
};

for (const scheme of ['light', 'dark'] as const) {
  for (const [name, path] of Object.entries(pages)) {
    test(`${name}, ${scheme} theme @visual`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(`./${path}`);
      await expect(page.locator('.lesson-head h2')).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await expect(page).toHaveScreenshot(`${name}-${scheme}.png`);
    });
  }
}

for (const scheme of ['light', 'dark'] as const) {
  test(`lesson vocabulary, ${scheme} theme @visual`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('./#/ru/lesson/x-nombres-calendari');
    const vocab = page.locator('#vocab');
    await vocab.scrollIntoViewIfNeeded();
    await page.evaluate(() => document.fonts.ready);
    await expect(vocab.locator('.vocab-table').nth(4)).toHaveScreenshot(`vocab-week-${scheme}.png`);
  });
}

for (const scheme of ['light', 'dark'] as const) {
  test(`checked exercise, ${scheme} theme @visual`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('./#/ru/lesson/x-temps-verbals');
    const ex = page.locator('[data-exercise="tenses"] .ex');
    const inputs = ex.locator('input');
    for (const [i, v] of ['vaig anar', 'he treballat', 'vivia', 'fara', 'havia comencat', 'viatjaré'].entries()) await inputs.nth(i).fill(v);
    await ex.getByRole('button', { name: 'Проверить' }).click();
    await ex.scrollIntoViewIfNeeded();
    await page.evaluate(() => document.fonts.ready);
    await expect(ex).toHaveScreenshot(`exercise-checked-${scheme}.png`);
  });
}
