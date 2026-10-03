// Renders the PNG icons from content/favicon.svg (run after changing the SVG: npm run icons).
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const content = join(dirname(fileURLToPath(import.meta.url)), '..', 'content');
const svg = readFileSync(join(content, 'favicon.svg'), 'utf8');

const browser = await chromium.launch();
// iOS rounds the corners of the home screen icon itself and turns transparency black:
// the apple-touch-icon is a full square
for (const [file, size, square] of [['favicon-32.png', 32, false], ['apple-touch-icon.png', 180, true]] as const) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const art = (square ? svg.replace('rx="14"', 'rx="0"') : svg).replace('<svg ', `<svg width="${size}" height="${size}" `);
  await page.setContent(`<html><body style="margin:0;background:transparent">${art}</body></html>`);
  await page.screenshot({ path: join(content, file), omitBackground: true });
  console.log(`${file}: ${size}×${size}`);
}
await browser.close();
