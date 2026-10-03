// Finds the Catalan phrases a reader can click in a lesson fragment.
// Mirrors the page: an element with lang="ca" is one phrase; in a table with lang="ca" every <td> is.
import { normalizeSayText } from '../../portal/js/say.js';

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
  return ENTITIES[e.toLowerCase()] ?? m;
});
const text = (html) => normalizeSayText(decode(html.replace(/<[^>]*>/g, '')));

export function extractSayTexts(html) {
  const found = [];
  const re = /<(span|td|li|blockquote|table|h3|p)\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(html))) {
    const [open, tag, attrs] = m;
    if (!/\blang="ca"/.test(attrs)) continue;
    const name = tag.toLowerCase();
    const end = findClose(html, name, m.index + open.length);
    const inner = html.slice(m.index + open.length, end);
    if (name === 'table') {
      for (const td of inner.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)) found.push(text(td[1]));
    } else {
      found.push(text(inner));
    }
    re.lastIndex = end;
  }
  return [...new Set(found.filter(Boolean))];
}

// index of the closing tag that matches an opening tag, allowing nested tags of the same name
function findClose(html, name, from) {
  const re = new RegExp(`<(/?)${name}\\b[^>]*>`, 'gi');
  re.lastIndex = from;
  let depth = 1;
  let m;
  while ((m = re.exec(html))) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return m.index;
  }
  return html.length;
}
