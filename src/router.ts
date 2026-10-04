// Routes: /:lang/plan/:focus? and /:lang/lesson/:id (hash history: GitHub Pages has no server rewrites).
// Old links of the form #<id> and #pla, and the saved last view, are resolved by resolveRoute.
import { createRouter, createWebHashHistory, type RouteLocationRaw, type RouterHistory } from 'vue-router';
import { PLAN_ID, resolveRoute, type Route } from './services/catalog.ts';
import { preferredLanguage, readerLanguages } from './services/content.ts';
import { useCatalogStore } from './stores/catalog.ts';
import { useProgressStore } from './stores/progress.ts';
import { useSyncStore } from './stores/sync.ts';

// "#b1-04" (links before the router) → "/b1-04", resolved by the catch-all route
export function legacyHashToPath(hash: string): string | null {
  const m = /^#([^/].*)$/.exec(hash);
  return m ? `/${m[1]}` : null;
}

function target(r: Route, lang: string): RouteLocationRaw {
  if (r.view === 'lesson') return { name: 'lesson', params: { lang, id: r.id } };
  return r.focus ? { name: 'plan', params: { lang, focus: r.focus } } : { name: 'plan', params: { lang } };
}

const param = (v: unknown): string => (typeof v === 'string' ? v : '');

interface ScrollTarget { name?: unknown; path: string; params?: Record<string, unknown> }

// A new page starts at the top; staying on the same page keeps the position. The plan with a
// focused unit scrolls to it itself (PlanView), once the page is laid out.
export function scrollFor(to: ScrollTarget, from: { path: string }): false | { top: number } {
  if (to.name === 'plan' && param(to.params?.focus)) return false;
  return to.path === from.path ? false : { top: 0 };
}

export function createAppRouter(history: RouterHistory = createWebHashHistory()) {
  const router = createRouter({
    history,
    routes: [
      { path: '/:lang/plan/:focus?', name: 'plan', component: () => import('./views/PlanView.vue') },
      { path: '/:lang/lesson/:id', name: 'lesson', component: () => import('./views/LessonView.vue') },
      { path: '/:lang/sync/:code?', name: 'sync', component: () => import('./views/SyncView.vue') },
      { path: '/:rest(.*)*', name: 'other', component: { render: () => null } },
    ],
    scrollBehavior: (to, from) => scrollFor(to, from),
  });

  router.beforeEach(async (to) => {
    const catalog = useCatalogStore();
    const progress = useProgressStore();
    const requested = param(to.params.lang);
    await catalog.load(requested, (locales) =>
      preferredLanguage(locales, { saved: progress.data.locale, hasHistory: progress.hasHistory(), browser: readerLanguages() }));
    const lang = catalog.lang;

    if (to.name === 'other') {
      const rest = Array.isArray(to.params.rest) ? to.params.rest : [];
      if (rest.length === 0) return target(resolveRoute(catalog.catalog, '', progress.last), lang);
      if (rest.length === 1) return target(resolveRoute(catalog.catalog, rest[0] ?? '', null), lang);
      return target({ view: 'plan', focus: null }, lang);
    }
    if (to.name === 'lesson') {
      const id = param(to.params.id);
      const r = resolveRoute(catalog.catalog, id, null);
      // a lesson not written in this language, but written in another: its page says where to read it
      const elsewhere = r.view === 'plan' && r.focus === id && (await catalog.findWrittenIn(id)).length > 0;
      if (elsewhere) return lang === requested ? true : { name: 'lesson', params: { lang, id } };
      if (lang !== requested || r.view !== 'lesson' || r.id !== id) return target(r, lang);
    }
    if (to.name === 'plan' && lang !== requested) {
      return target({ view: 'plan', focus: param(to.params.focus) || null }, lang);
    }
    if (to.name === 'sync') {
      // a code from a QR link moves into memory at once, so it does not stay in the browser history
      const code = param(to.params.code);
      if (code) useSyncStore().offer(code);
      if (code || lang !== requested) return { name: 'sync', params: { lang }, replace: true };
    }
    return true;
  });

  router.afterEach((to) => {
    const lang = param(to.params.lang);
    if (lang) useProgressStore().setLocale(lang);
    if (to.name === 'lesson') useProgressStore().setLast(param(to.params.id));
    else if (to.name === 'plan') useProgressStore().setLast(PLAN_ID);
  });

  return router;
}
