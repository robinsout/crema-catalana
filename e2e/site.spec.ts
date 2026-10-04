import { test, expect, type Page } from './fixtures.ts';

const KEY = 'quadern-catala';

// progress saved before the page opens (as earlier versions of the site wrote it)
async function withSavedProgress(page: Page, json: string): Promise<void> {
  await page.addInitScript(({ key, value }) => {
    if (sessionStorage.getItem('seeded')) return; // only before the first load, not on reloads
    localStorage.setItem(key, value);
    sessionStorage.setItem('seeded', '1');
  }, { key: KEY, value: json });
}

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

test('first visit opens the study plan', async ({ page }) => {
  await page.goto('./');
  await expect(page).toHaveURL(/#\/ru\/plan$/);
  await expect(page.locator('.lesson-head h2')).toContainText('Passos 1');
});

test('an old link to a lesson still works', async ({ page }) => {
  await page.goto('./#x-temps-verbals');
  await expect(page).toHaveURL(/#\/ru\/lesson\/x-temps-verbals$/);
  await expect(page.locator('.lesson-head h2')).toHaveText('Els temps verbals');
});

test('an old link to an unwritten unit shows that unit at the top of the plan', async ({ page }) => {
  await page.goto('./#b1-04');
  await expect(page).toHaveURL(/#\/ru\/plan\/b1-04$/);
  const unit = page.locator('#u-b1-04');
  await expect(unit).toHaveClass(/focus/);
  await page.evaluate(() => document.fonts.ready);
  // on narrow screens the header stays on top: the unit lands right below it, not under it
  // (on wide screens .side is the sticky sidebar column, not a header)
  const header = await page.locator('.side').evaluate((el) => (matchMedia('(max-width: 899px)').matches ? el.getBoundingClientRect().bottom : 0));
  await expect.poll(async () => (await unit.boundingBox())?.y ?? -1, { timeout: 5000 }).toBeGreaterThanOrEqual(header - 2);
  await expect.poll(async () => (await unit.boundingBox())?.y ?? 9999, { timeout: 5000 }).toBeLessThan(header + 80);
});

test('phones: the header stays on top, its menu starts with the chapters of the lesson', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'the menu is for narrow screens');
  await page.goto('./#/ru/lesson/x-temps-verbals');
  await page.evaluate(() => window.scrollTo(0, 3000));
  const menu = page.locator('button[aria-controls="nav"]');
  await expect(menu).toBeInViewport();
  await expect(page.locator('.toc-toggle')).toBeHidden();
  await menu.click();
  await page.locator('.nav-chapters a', { hasText: 'Практика' }).click();
  await expect(page.locator('#nav')).toBeHidden();
  const header = await page.locator('.side').evaluate((el) => el.getBoundingClientRect().bottom);
  await expect.poll(async () => (await page.locator('#practica h2').boundingBox())?.y ?? -1).toBeGreaterThanOrEqual(header - 2);
});

test('a chapter mark and the reading point survive a reload', async ({ page }) => {
  await page.goto('./#/ru/lesson/x-temps-verbals');
  await page.locator('#mapa .section-end button').click();
  await page.evaluate(() => document.getElementById('formes')?.scrollIntoView());
  await page.waitForTimeout(5000); // smooth scrolling, then 3 s on screen: the chapter counts as read
  await page.goto('./#/ru/plan');
  await page.reload();
  await page.locator('.continue a').click(); // the plan offers to continue this lesson
  await expect(page).toHaveURL(/#\/ru\/lesson\/x-temps-verbals$/);
  await expect(page.locator('#mapa .section-end button')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.resume')).toContainText('Формы на примере parlar');
});

test('progress saved by the first version of the site shows up', async ({ page }) => {
  await withSavedProgress(page, '{"done":{"l01":true},"last":"l01"}');
  await page.goto('./');
  await expect(page).toHaveURL(/#\/ru\/lesson\/intro$/);
  await expect(page.locator('.head-actions .btn')).toHaveClass(/is-done/);
});

test('a lesson marked as done stays done after a reload', async ({ page }) => {
  await page.goto('./#/ru/lesson/x-nombres-calendari');
  await page.locator('.head-actions .btn').click();
  await expect(page.locator('.head-actions .btn')).toHaveClass(/is-done/);
  await page.reload();
  await expect(page.locator('.head-actions .btn')).toHaveClass(/is-done/);
});

test('a click on a Catalan phrase plays its recording', async ({ page }) => {
  await page.goto('./#/ru/lesson/intro');
  const phrase = page.locator('article.lesson span[lang="ca"]').first();
  await expect(page.locator('html')).toHaveClass(/can-say/);
  const clip = page.waitForRequest(/\/audio\/clips\/[0-9a-f]+\.mp3$/);
  await phrase.click();
  await clip;
  // the tests are silent: recordings play muted (e2e/fixtures.ts)
  expect(await page.evaluate(() => { const a = new Audio(); void a.play().catch(() => {}); return a.muted; })).toBe(true);
});

test('fonts are served with the site', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (r) => { if (!r.url().startsWith('http://localhost')) external.push(r.url()); });
  await page.goto('./#/ru/lesson/intro');
  await expect(page.locator('article.lesson .ipa').first()).toBeVisible(); // text in all three fonts is on screen
  await page.evaluate(() => document.fonts.ready);
  const loaded = await page.evaluate(() =>
    [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, '')));
  for (const family of ['Literata', 'Unbounded', 'JetBrains Mono']) expect(loaded).toContain(family);
  expect(external).toEqual([]);
});

test('no page scrolls sideways', async ({ page }) => {
  for (const path of ['#/ru/plan', '#/ru/lesson/intro', '#/ru/lesson/x-temps-verbals', '#/ru/lesson/x-nombres-calendari']) {
    await page.goto(`./${path}`);
    await expect(page.locator('.lesson-head h2')).toBeVisible();
    expect(await noHorizontalScroll(page), path).toBe(true);
  }
});

test('the menu leads from the plan to a lesson and back', async ({ page, isMobile }) => {
  await page.goto('./#/ru/plan');
  if (isMobile) await page.locator('button[aria-controls="nav"]').click();
  await page.locator('.lesson-list a', { hasText: 'Els temps verbals' }).click();
  await expect(page).toHaveURL(/#\/ru\/lesson\/x-temps-verbals$/);
  if (isMobile) await page.locator('button[aria-controls="nav"]').click();
  await page.locator('.lesson-list a.plan-link').click();
  await expect(page).toHaveURL(/#\/ru\/plan$/);
});

test('a lesson vocabulary is listed at the end and its words can be heard', async ({ page }) => {
  await page.goto('./#/ru/lesson/x-nombres-calendari');
  const vocab = page.locator('#vocab');
  await expect(vocab.locator('h2')).toHaveText('Слова урока');
  const row = vocab.locator('tr', { hasText: 'el dilluns' });
  await expect(row).toContainText('понедельник');
  const word = row.locator('.vocab-ca');
  await expect(page.locator('html')).toHaveClass(/can-say/);
  const clip = page.waitForRequest(/\/audio\/clips\/[0-9a-f]+\.mp3$/);
  await word.click();
  await clip;
  expect(await noHorizontalScroll(page)).toBe(true);
});

test('an exercise checks typed answers and remembers the result', async ({ page }) => {
  await page.goto('./#/ru/lesson/x-nombres-calendari');
  const ex = page.locator('[data-exercise="quarts"] .ex');
  const inputs = ex.locator('input');
  await expect(inputs).toHaveCount(4);
  await inputs.nth(0).fill('un quart de deu');
  await inputs.nth(1).fill('Dos quarts de set.');
  await inputs.nth(2).fill('tres quarts d’una');
  await inputs.nth(3).fill('un quart de onze');
  await inputs.nth(3).press('Enter');
  await expect(ex.locator('.ex-score')).toHaveText('Верно: 3 из 4');
  await expect(ex.locator('li').nth(3)).toHaveClass(/is-wrong/);
  await expect(ex.locator('li').nth(3).locator('.ex-solution')).toContainText("un quart d'onze");
  await page.reload();
  await expect(page.locator('[data-exercise="quarts"] .ex-last')).toHaveText('Последний результат: 3 из 4');
});

test('a choice exercise shows the right option after a pick', async ({ page }) => {
  await page.goto('./#/ru/lesson/x-temps-verbals');
  const first = page.locator('[data-exercise="which-tense"] li').first();
  await first.getByRole('button', { name: 'Imperfet', exact: true }).click();
  await expect(first).toHaveClass(/is-wrong/);
  await expect(first.getByRole('button', { name: 'Perfet', exact: true })).toHaveClass(/right/);
  await expect(first).toContainText('период ещё не закончился');
});

test('the site has an icon', async ({ page, request }) => {
  await page.goto('./');
  for (const sel of ['link[rel="icon"][type="image/svg+xml"]', 'link[rel="icon"][type="image/png"]', 'link[rel="apple-touch-icon"]']) {
    const href = await page.locator(sel).getAttribute('href');
    expect(href, sel).toBeTruthy();
    const res = await request.get(new URL(href ?? '', page.url()).href);
    expect(res.ok(), `${sel} → ${href}`).toBe(true);
  }
});

test('no page breaks the Content-Security-Policy', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { cspViolations: string[] }).cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      (window as unknown as { cspViolations: string[] }).cspViolations.push(`${e.violatedDirective} ${e.blockedURI}`);
    });
  });
  const violations = () => page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations);
  await page.goto('./');
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveCount(1);
  await expect(page.locator('.lesson-head h2')).toContainText('Passos 1');
  await page.goto('./#/ru/lesson/x-nombres-calendari');
  await expect(page.locator('.lesson-head h2')).toBeVisible();
  await expect(page.locator('html')).toHaveClass(/can-say/);
  const clip = page.waitForRequest(/\/audio\/clips\/[0-9a-f]+\.mp3$/);
  await page.locator('article.lesson span[lang="ca"]').first().click();
  await clip;
  await page.goto('./#/ru/sync');
  await page.getByRole('button', { name: 'Включить синхронизацию' }).click();
  await expect(page.locator('.lesson .sync-status')).toHaveClass(/ok/);
  await page.evaluate(() => document.fonts.ready);
  expect(await violations()).toEqual([]);
});
