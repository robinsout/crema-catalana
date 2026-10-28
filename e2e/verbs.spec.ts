import { test, expect } from './fixtures.ts';

// The verb reference in a real browser (BACKLOG I-11): menu → list → search by a form → verb page;
// the tense choice survives a reload; the page fits a phone without sideways scrolling.
test('the menu leads to the verbs; a form finds its verb; the tense choice stays after a reload', async ({ page, isMobile }) => {
  await page.goto('./#/ru/plan');
  if (isMobile) await page.getByRole('button', { name: 'Меню' }).click();
  await page.locator('a.verbs-link').click();
  await expect(page).toHaveURL(/#\/ru\/verbs$/);
  await expect(page.locator('.verb-inf').first()).toHaveText('ser');
  expect(await page.locator('.verb-list li').count()).toBeGreaterThanOrEqual(500);

  await page.getByRole('searchbox').fill('vaig');
  await expect(page.locator('.verb-inf').first()).toHaveText('anar');
  await page.locator('.verb-list a').first().click();
  await expect(page.locator('.lesson-head h2')).toHaveText('anar');
  await expect(page.locator('.conj-card[data-tense="ind.fut"]')).toContainText('aniré');

  await page.locator('.tense-settings summary').click();
  await page.locator('input[data-tense="ind.simple"]').check();
  await expect(page.locator('.conj-card[data-tense="ind.simple"]')).toContainText('anà');
  await page.reload();
  await expect(page.locator('.conj-card[data-tense="ind.simple"]')).toBeVisible();

  await page.goBack();
  await expect(page.getByRole('searchbox')).toHaveValue('vaig');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
