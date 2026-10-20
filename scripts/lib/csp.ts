// Content-Security-Policy of the site. GitHub Pages cannot send headers, so the build puts it
// into a <meta> tag (vite.config.ts). Lesson HTML uses style="…" attributes, hence 'unsafe-inline'
// for styles; the CSS draws a few masks from data: URLs. Requests: the sync server and the visit counter.
export function contentSecurityPolicy(syncUrl: string, counterUrl = ''): string {
  const connect = [...new Set(["'self'", new URL(syncUrl).origin, ...(counterUrl ? [new URL(counterUrl).origin] : [])])];
  return [
    "default-src 'self'",
    "script-src 'self'",
    `connect-src ${connect.join(' ')}`,
    "img-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ');
}
