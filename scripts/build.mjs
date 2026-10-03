// Builds the GitHub Pages site from portal/.
// portal/index.html is written for the claude.ai Artifact host, which adds the
// <html>/<head>/<body> skeleton itself; for Pages we add it here.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HEAD = [
  '<!doctype html>',
  '<html lang="ru">',
  '<head>',
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
  '<style>body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>',
  '</head>',
  '<body>',
].join('\n');
const TAIL = '\n</body>\n</html>\n';

export function build({ src, out }) {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  cpSync(src, out, { recursive: true });
  const page = readFileSync(join(src, 'index.html'), 'utf8');
  writeFileSync(join(out, 'index.html'), `${HEAD}\n${page}${TAIL}`);
  writeFileSync(join(out, '.nojekyll'), '');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const out = join(root, '_site');
  build({ src: join(root, 'portal'), out });
  console.log(`Built ${out}`);
}
