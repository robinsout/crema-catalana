// Load speed of pages: the request waterfall, first and largest contentful paint, on a fast and a slow network.
// npm run perf -- [site url] [#/route ...]   (default: the live site, the plan and a lesson)
// A local build: npm run build && npm run preview, then npm run perf -- http://localhost:4173/
import { chromium } from '@playwright/test';

const SLOW = { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 }; // "fast 3G"
const [site = 'https://robinsout.github.io/crema-catalana/', ...routes] = process.argv.slice(2);
const pages = routes.length ? routes : ['#/ru/plan', '#/ru/lesson/b1-04'];

interface Row { url: string; start: number; end: number; bytes: number }

const browser = await chromium.launch();
for (const slow of [false, true]) {
  for (const route of pages) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    if (slow) await cdp.send('Network.emulateNetworkConditions', SLOW);
    const rows: Promise<Row>[] = [];
    const t0 = Date.now();
    page.on('requestfinished', (r) => rows.push((async () => {
      const t = r.timing();
      const sizes = await r.sizes().catch(() => ({ responseBodySize: 0 }));
      return { url: r.url().replace(site, ''), start: Math.round(t.startTime - t0), end: Math.round(t.startTime - t0 + t.responseEnd), bytes: sizes.responseBodySize };
    })()));
    await page.goto(site + route, { waitUntil: 'networkidle' });
    const paints = await page.evaluate(() => new Promise<[number, number]>((resolve) => {
      const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? -1;
      new PerformanceObserver((list) => {
        const all = list.getEntries();
        resolve([Math.round(fcp), Math.round(all[all.length - 1]?.startTime ?? -1)]);
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      setTimeout(() => resolve([Math.round(fcp), -1]), 1000);
    }));
    const done = (await Promise.all(rows)).sort((a, b) => a.start - b.start);
    const kb = Math.round(done.reduce((sum, r) => sum + Math.max(r.bytes, 0), 0) / 1024);
    console.log(`\n${route} · ${slow ? 'slow network' : 'fast network'} · FCP ${paints[0]} ms · LCP ${paints[1]} ms · ${done.length} requests, ${kb} KB`);
    for (const r of done) console.log(`${String(r.start).padStart(6)} → ${String(r.end).padStart(6)} ms ${String(r.bytes).padStart(8)}  ${r.url.slice(0, 80) || '(page)'}`);
    await context.close();
  }
}
await browser.close();
