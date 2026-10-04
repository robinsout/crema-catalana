// npm run look -- <path>… : screenshots of pages to look at while writing content (not a test).
// Light and dark theme, desktop and phone, the top of the page; saved to test-results/look/.
// Without LOOK (the usual e2e runs) it is skipped.
import { test } from './fixtures.ts';

const paths = (process.env.LOOK ?? '').split(',').filter(Boolean);
const name = (path: string) => path.replace(/^[#./]+/, '').replace(/[^a-z0-9-]+/gi, '_');

test.describe('look', () => {
  test.skip(paths.length === 0, 'npm run look -- <path>');
  for (const path of paths) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`${path} ${scheme}`, async ({ page }, info) => {
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(`./${path.startsWith('#') ? path : `#${path}`}`);
        await page.locator('main h2').first().waitFor();
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ path: `test-results/look/${name(path)}-${info.project.name}-${scheme}.png` });
      });
    }
  }
});
