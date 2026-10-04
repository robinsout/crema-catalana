// Whether the site is shown inside a frame of another page. GitHub Pages cannot send
// frame-ancestors, so actions a framing page could trick the reader into (clickjacking) check this.
export function isFramed(): boolean {
  try { return globalThis.top !== globalThis.self; } catch { return true; }
}
