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
