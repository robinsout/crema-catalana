import { test, expect } from './fixtures.ts';

// The conjugation trainer in a real browser (BACKLOG I-12): typing with the letters checked, a wrong
// letter, the tense row and "Next", the pause after a right form, the day's count after a reload.
// One verb, one tense, one person: the task is always "ser · jo · Present" → soc.
const ONE_TASK = JSON.stringify({ done: {}, last: null, verbTenses: ['ind.pres'],
  trainer: { settings: { persons: [true, false, false, false, false, false], limit: 300, kinds: { regular: true, irregular: true }, goal: 25 } } });

test('typing: a wrong letter, the tense row and Next; a right form, the pause and the previous one', async ({ page }) => {
  await page.addInitScript((saved) => { if (!localStorage.getItem('quadern-catala')) localStorage.setItem('quadern-catala', saved); }, ONE_TASK);
  await page.goto('./#/ru/trainer?verb=ser');
  await expect(page.locator('.tr-ask')).toContainText('jo · Present');
  await page.locator('.tr-field').click();

  await page.keyboard.type('sx');
  await expect(page.locator('.tr-letters .l-bad')).toHaveText('x');
  await expect(page.locator('.tr-status')).toContainText('Не та буква');
  await page.keyboard.type('y');
  await expect(page.locator('.tr-input')).toHaveValue('sx');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('oc');
  await expect(page.locator('.tr-status')).toContainText('С ошибкой');
  await expect(page.locator('.tr-row .asked')).toHaveText('soc');
  await page.keyboard.press('Enter');
  await expect(page.locator('.tr-input')).toHaveValue('');
  await expect(page.locator('.tr-input')).toBeFocused();

  await page.keyboard.type('soc');
  await expect(page.locator('.tr-field')).toHaveClass(/is-correct/);
  await expect(page.locator('.tr-prev')).toContainText('soc', { timeout: 3000 });
  await expect(page.locator('.tr-input')).toHaveValue('');

  await page.reload();
  await expect(page.locator('.tr-goal')).toContainText('2 / 25');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('the tabs lead from the reference to the trainer and back', async ({ page }) => {
  await page.goto('./#/ru/verbs');
  await page.locator('.area-tabs a', { hasText: 'Тренажёр' }).click();
  await expect(page).toHaveURL(/#\/ru\/trainer$/);
  await expect(page.locator('.tr-card')).toBeVisible();
  await page.locator('.area-tabs a', { hasText: 'Справочник' }).click();
  await expect(page.locator('.verb-list li').first()).toBeVisible();
});
