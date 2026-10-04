// npm run look -- '#/ru/lesson/b1-04' ['#/en/plan' …] — screenshots to check a page by eye
// (desktop and phone, light and dark), saved to test-results/look/. See e2e/look.spec.ts.
import { spawnSync } from 'node:child_process';

const paths = process.argv.slice(2);
if (!paths.length) {
  console.error("usage: npm run look -- '#/ru/lesson/<id>' […]");
  process.exit(1);
}
const r = spawnSync('npx', ['playwright', 'test', 'e2e/look.spec.ts', '--reporter=line'], {
  stdio: 'inherit',
  env: { ...process.env, LOOK: paths.join(',') },
});
if (r.status === 0) console.log('screenshots: test-results/look/');
process.exit(r.status ?? 1);
