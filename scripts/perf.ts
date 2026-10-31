// Load speed of pages: the request waterfall, first and largest contentful paint, on a fast and a slow
// network, for a first visit and a repeat one (served by the service worker).
// npm run perf -- [site url] [#/route ...]   (default: the live site, the plan and a lesson)
// A local build: npm run build && npm run preview, then npm run perf -- http://localhost:4173/
import { chromium, type Page, type Request } from '@playwright/test';

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
    await measure(page, route, `${slow ? 'slow network' : 'fast network'} · first visit`);
    // a repeat visit: the service worker (BACKLOG I-6) installed by the first one answers
    const worker = await page.evaluate(() => Promise.race([
      navigator.serviceWorker?.ready.then(() => true) ?? Promise.resolve(false),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 10_000)),
    ]));
    if (worker) await measure(page, route, `${slow ? 'slow network' : 'fast network'} · repeat visit`, true);
    await context.close();
  }
}
await browser.close();

async function measure(page: Page, route: string, title: string, reload = false): Promise<void> {
  const rows: Promise<Row>[] = [];
  const t0 = Date.now();
  const onFinished = (r: Request) => rows.push((async () => {
    const t = r.timing();
    const sizes = await r.sizes().catch(() => ({ responseBodySize: 0 }));
    const cached = (await r.response())?.fromServiceWorker() ? ' (sw)' : '';
    return { url: r.url().replace(site, '') + cached, start: Math.round(t.startTime - t0), end: Math.round(t.startTime - t0 + t.responseEnd), bytes: sizes.responseBodySize };
  })());
  page.on('requestfinished', onFinished);
  if (reload) await page.reload({ waitUntil: 'networkidle' });
  else await page.goto(site + route, { waitUntil: 'networkidle' });
  page.off('requestfinished', onFinished);
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
  console.log(`\n${route} · ${title} · FCP ${paints[0]} ms · LCP ${paints[1]} ms · ${done.length} requests, ${kb} KB`);
  for (const r of done) console.log(`${String(r.start).padStart(6)} → ${String(r.end).padStart(6)} ms ${String(r.bytes).padStart(8)}  ${r.url.slice(0, 80) || '(page)'}`);
}
