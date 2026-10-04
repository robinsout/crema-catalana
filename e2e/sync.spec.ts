import { test, expect, type Browser } from './fixtures.ts';

// Two devices = two browser contexts with separate storage, one local sync server.
async function device(browser: Browser, path: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(path);
  return { context, page };
}

test('progress made on one device appears on another after joining with the QR link', async ({ browser, baseURL }) => {
  const laptop = await device(browser, `${baseURL}#/ru/lesson/intro`);
  await laptop.page.locator('.head-actions .btn').click();
  await laptop.page.goto(`${baseURL}#/ru/sync`);
  await laptop.page.getByRole('button', { name: 'Включить синхронизацию' }).click();
  await expect(laptop.page.locator('.lesson .sync-status')).toHaveClass(/ok/);
  await expect(laptop.page.locator('.sync-qr svg')).toBeVisible();
  const link = (await laptop.page.locator('.sync-link-text').textContent()) ?? '';
  expect(link).toMatch(/#\/ru\/sync\/[0-9A-Z]{27}$/);

  // the phone already did another lesson before joining
  const phone = await device(browser, `${baseURL}#/ru/lesson/x-temps-verbals`);
  await phone.page.locator('.head-actions .btn').click();
  await phone.page.goto(link);
  await expect(phone.page).toHaveURL(/#\/ru\/sync$/); // the code leaves the address bar at once
  await phone.page.goBack(); // and the history: the entry with the code was replaced, "back" leads to the lesson
  await expect(phone.page).toHaveURL(/#\/ru\/lesson\/x-temps-verbals$/);
  await phone.page.goForward();
  await phone.page.getByRole('button', { name: 'Подключить' }).click();
  await expect(phone.page.locator('.lesson .sync-status')).toHaveClass(/ok/);
  await phone.page.goto(`${baseURL}#/ru/lesson/intro`);
  await expect(phone.page.locator('.head-actions .btn')).toHaveClass(/is-done/);

  // and the laptop gets the phone's lesson on the next sync
  await laptop.page.getByRole('button', { name: 'Синхронизировать сейчас' }).click();
  await laptop.page.goto(`${baseURL}#/ru/lesson/x-temps-verbals`);
  await expect(laptop.page.locator('.head-actions .btn')).toHaveClass(/is-done/);

  await laptop.context.close();
  await phone.context.close();
});

test('a typed code with a typo is refused', async ({ page }) => {
  await page.goto('./#/ru/sync');
  await page.getByRole('button', { name: 'У меня уже есть код' }).click();
  await page.locator('#sync-code-input').fill('ABCD-EFGH-JKMN-PQRS-TVWX-YZ01-234');
  await page.getByRole('button', { name: 'Подключить' }).click();
  await expect(page.locator('.sync-error')).toBeVisible();
});

test('the sync page sends nothing on its own; only the button syncs', async ({ page }) => {
  const toServer: string[] = [];
  page.on('request', (r) => { if (r.url().startsWith('http://localhost:8787')) toServer.push(r.url()); });
  await page.goto('./#/ru/sync');
  await page.getByRole('button', { name: 'Включить синхронизацию' }).click();
  await expect(page.locator('.lesson .sync-status')).toHaveClass(/ok/);
  const afterEnable = toServer.length;
  await page.waitForTimeout(4000);
  expect(toServer.length).toBe(afterEnable);
  await page.reload();
  await expect(page.locator('.lesson .sync-status')).toHaveClass(/ok/);
  await page.waitForTimeout(2000);
  expect(toServer.length).toBe(afterEnable);
  await page.getByRole('button', { name: 'Синхронизировать сейчас' }).click();
  await expect.poll(() => toServer.length).toBeGreaterThan(afterEnable);
});

test('inside a frame of another page the sync page offers no actions', async ({ page, baseURL }) => {
  await page.setContent(`<iframe src="${baseURL}#/ru/sync" width="800" height="600"></iframe>`);
  const site = page.frameLocator('iframe');
  await expect(site.locator('.sync-framed')).toBeVisible();
  await expect(site.getByRole('button', { name: 'Включить синхронизацию' })).toHaveCount(0);
});
