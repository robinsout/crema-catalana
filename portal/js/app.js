// Page layer: renders navigation, the study plan and lessons. Logic lives in model.js and storage.js.
import { createStore } from './storage.js';
import { clipFor } from './say.js';
import { createT } from './i18n.js';
import {
  PLAN_ID, normalizeCatalog, buildCatalog, allLessons, findLesson, resolveRoute,
  progress, neighbours, lessonLabel, relatedExtras,
} from './model.js';

let backend = null;
try { backend = window.localStorage; } catch (e) { backend = null; }
const store = createStore(backend);
let catalog = normalizeCatalog({});
let current = null; // PLAN_ID or lesson id
let lang = 'ru';
let ui = {};
let t = createT(ui);

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const badge = (l) => (l.track === 'unit' ? l.unit : l.kind === 'overview' ? t('badge.overview') : t('badge.topic'));

/* ---------- navigation ---------- */
function renderNav() {
  const item = (l) => {
    const sub = l.track === 'extra' && l.subtitle ? `<span class="s">${esc(l.subtitle)}</span>` : '';
    const inner = `<span class="n">${badge(l)}</span><span><span class="t" lang="ca">${esc(l.title)}</span>${sub}</span>`;
    const cur = current === l.id ? ' aria-current="page"' : '';
    const cls = [l.file ? '' : 'soon', store.state.done[l.id] ? 'done' : ''].join(' ').trim();
    return `<li><a href="#${l.id}" class="${cls}"${cur}>${inner}</a></li>`;
  };
  const lessons = allLessons(catalog);
  const planCur = current === PLAN_ID ? ' aria-current="page"' : '';
  let html = `<li><a href="#${PLAN_ID}" class="plan-link"${planCur}><span class="n">☰</span><span><span class="t">${t('nav.plan')}</span><span class="s">${t('nav.planSub', { course: esc(catalog.course.title || '') })}</span></span></a></li>`;
  const extras = lessons.filter((l) => l.track === 'extra');
  if (extras.length) {
    html += `<li class="part-h">${t('nav.extras')}</li>` + extras.map(item).join('');
  }
  for (const p of catalog.parts) {
    html += `<li class="part-h"><span lang="ca">${esc(p.title)}</span> · ${esc(p.period)}</li>`;
    html += lessons.filter((l) => l.part === p || (l.part && l.part.id === p.id)).map(item).join('');
  }
  $('lessonList').innerHTML = html;
  const pr = progress(catalog, store.state.done);
  $('progressText').innerHTML = `<span>${t('progress.done', pr)}</span><span>${t('progress.ready', pr)}</span>`;
  $('progressBar').style.width = pr.ready ? (pr.done / pr.ready * 100) + '%' : '0';
}

$('navToggle').addEventListener('click', () => {
  const open = $('nav').classList.toggle('open');
  $('navToggle').setAttribute('aria-expanded', String(open));
});

function closeNav() {
  $('nav').classList.remove('open');
  $('navToggle').setAttribute('aria-expanded', 'false');
}

function route() {
  const r = resolveRoute(catalog, location.hash.slice(1), store.state.last);
  if (r.view === 'lesson') showLesson(findLesson(catalog, r.id));
  else showPlan(r.focus);
}

/* ---------- study plan ---------- */
function statusPill(l) {
  if (!l.file) return `<span class="pill">${t('pill.soon')}</span>`;
  return `<a class="pill ok" href="#${l.id}">${store.state.done[l.id] ? t('pill.done') : t('pill.open')}</a>`;
}

function unitRow(u) {
  const related = relatedExtras(catalog, u.id);
  const rel = related.length
    ? `<dt>${t('plan.topics')}</dt><dd>${related.map((x) => `<a href="#${x.id}" lang="ca">${esc(x.title)}</a>`).join(', ')}</dd>`
    : '';
  return `<div class="unit" id="u-${u.id}">
    <div class="unit-n">${u.unit}</div>
    <div class="unit-body">
      <div class="unit-top"><h3 lang="ca">${esc(u.title)}</h3>${statusPill(u)}</div>
      <p class="unit-topic">${esc(u.topic)}</p>
      <ul class="chips">${(u.grammar || []).map((g) => `<li>${esc(g)}</li>`).join('')}</ul>
      <dl class="unit-dl">
        <dt>${t('plan.vocab')}</dt><dd>${esc(u.vocab)}</dd>
        <dt>${t('plan.extra')}</dt><dd>${esc(u.extra)}</dd>
        <dt>${t('plan.mission')}</dt><dd>${esc(u.mission)}</dd>
        ${rel}
      </dl>
    </div>
  </div>`;
}

function extraRow(x) {
  const units = (x.related || []).map((id) => findLesson(catalog, id)).filter(Boolean);
  const rel = units.length
    ? `<dl class="unit-dl"><dt>${t('plan.forUnits')}</dt><dd>${units.map((u) => `<a href="#${u.id}">${esc(u.part.title)} · ${u.unit}</a>`).join(', ')}</dd></dl>`
    : '';
  return `<div class="unit" id="u-${x.id}">
    <div class="unit-n">${badge(x)}</div>
    <div class="unit-body">
      <div class="unit-top"><h3 lang="ca">${esc(x.title)}</h3>${statusPill(x)}</div>
      <p class="unit-topic">${esc(lessonLabel(x, t))}${x.subtitle ? ` · ${esc(x.subtitle)}` : ''}</p>
      ${rel}
    </div>
  </div>`;
}

function showPlan(focusId) {
  current = PLAN_ID;
  store.setLast(PLAN_ID);
  renderNav();
  closeNav();
  const c = catalog.course;
  const extras = allLessons(catalog).filter((l) => l.track === 'extra');
  $('main').innerHTML = `
    <header class="lesson-head">
      <p class="eyebrow">${t('plan.eyebrow')}</p>
      <h2 lang="ca">${esc(c.title || 'Passos 1')}${c.level ? ` · ${esc(c.level)}` : ''}</h2>
      <p class="sub">${t('plan.sub', { course: esc(c.title || ''), publisher: esc(c.publisher || '') })}</p>
    </header>
    <article class="lesson plan">
      <p>${t('plan.intro')}</p>
      <p class="meta">${t('plan.note')}</p>
      <ol class="parts">
        ${extras.length ? `<li><a href="#" data-sec="extras"><span class="parts-t">${t('plan.extrasCard')}</span><span class="parts-p">${t('plan.onRequest')}</span><span class="parts-f">${t('plan.extrasCount', { n: extras.length })}</span></a></li>` : ''}
        ${catalog.parts.map((p) => `
        <li><a href="#" data-sec="${p.id}"><span class="parts-t" lang="ca">${esc(p.title)}</span><span class="parts-p">${esc(p.period)}</span><span class="parts-f">${esc(p.focus)}</span></a></li>`).join('')}
      </ol>
      ${extras.length ? `
      <section id="extras">
        <h2><span>${t('plan.extrasTitle')}</span> <span class="h-period">${t('plan.onRequest')}</span></h2>
        <p>${t('plan.extrasLead')}</p>
        ${extras.map(extraRow).join('')}
      </section>` : ''}
      ${catalog.parts.map((p) => `
      <section id="${p.id}">
        <h2><span lang="ca">${esc(p.title)}</span> <span class="h-period">${esc(p.period)}</span></h2>
        <p>${esc(p.focus)}.</p>
        ${p.units.map(unitRow).join('')}
      </section>`).join('')}
    </article>`;
  buildToc();
  const el = focusId && document.getElementById('u-' + focusId);
  if (el) { el.classList.add('focus'); el.scrollIntoView({ block: 'start' }); } else window.scrollTo(0, 0);
}

/* ---------- lesson ---------- */
async function showLesson(lesson) {
  current = lesson.id;
  store.setLast(lesson.id);
  renderNav();
  closeNav();

  let body;
  try {
    const res = await fetch(lesson.file);
    if (!res.ok) throw new Error(res.status);
    body = await res.text();
  } catch (e) {
    $('main').innerHTML = `<p class="status">${t('status.lessonError', { title: esc(lesson.title) })}</p>`;
    return;
  }
  if (current !== lesson.id) return;

  const { prev, next } = neighbours(catalog, lesson.id);
  const date = lesson.date ? new Date(lesson.date + 'T12:00:00').toLocaleDateString(ui._dateLocale || lang, { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const related = lesson.track === 'unit' ? relatedExtras(catalog, lesson.id).filter((x) => x.file) : [];

  $('main').innerHTML = `
    <header class="lesson-head">
      <p class="eyebrow">${esc(lessonLabel(lesson, t))}</p>
      <h2 lang="ca">${esc(lesson.title)}</h2>
      <p class="sub">${esc(lesson.subtitle || lesson.topic || '')}</p>
      <div class="head-actions">
        <button class="btn" id="doneBtn" type="button"></button>
        ${date ? `<span class="meta">${date}</span>` : ''}
      </div>
    </header>
    <article class="lesson">${body}</article>
    ${related.length ? `<p class="related">${t('lesson.related')} ${related.map((x) => `<a href="#${x.id}" lang="ca">${esc(x.title)}</a>`).join(', ')}</p>` : ''}
    <nav class="pager" aria-label="${t('pager.label')}">
      ${prev ? `<a href="#${prev.id}">← ${esc(prev.title)}</a>` : `<a href="#${PLAN_ID}">${t('pager.planPrev')}</a>`}
      ${next ? `<a href="#${next.id}">${esc(next.title)} →</a>` : `<a href="#${PLAN_ID}">${t('pager.planNext')}</a>`}
    </nav>`;
  paintDone(lesson.id);
  $('doneBtn').addEventListener('click', () => {
    store.toggleDone(lesson.id);
    paintDone(lesson.id);
    renderNav();
  });
  buildToc();
  window.scrollTo(0, 0);
}

function paintDone(id) {
  const b = $('doneBtn');
  const d = !!store.state.done[id];
  b.textContent = d ? t('lesson.isDone') : t('lesson.markDone');
  b.classList.toggle('is-done', d);
}

/* ---------- table of contents ---------- */
let spy;
function buildToc() {
  const secs = [...document.querySelectorAll('.lesson section[id]')];
  $('toc').innerHTML = secs.length ? `<p>${current === PLAN_ID ? t('toc.plan') : t('toc.lesson')}</p><ol>${secs.map((s) => {
    const h = s.querySelector('h2');
    const t = h ? (h.querySelector('span') || h).textContent.replace(/^\d+\.\s*/, '') : s.id;
    return `<li><a href="#" data-sec="${s.id}">${esc(t)}</a></li>`;
  }).join('')}</ol>` : '';
  if (spy) spy.disconnect();
  if (!('IntersectionObserver' in window)) return;
  spy = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      document.querySelectorAll('.toc a').forEach((a) => a.classList.toggle('active', a.dataset.sec === e.target.id));
    });
  }, { rootMargin: '-20% 0px -70% 0px' });
  secs.forEach((s) => spy.observe(s));
}
const jump = (e) => {
  const a = e.target.closest('a[data-sec]');
  if (!a) return;
  e.preventDefault();
  const el = document.getElementById(a.dataset.sec);
  if (el) el.scrollIntoView();
};
$('toc').addEventListener('click', jump);
$('main').addEventListener('click', jump);

/* ---------- pronunciation (recorded clips) ---------- */
let sayManifest = null;
const player = new Audio();

// one shared index for the whole site: phrase → clips/<hash>.mp3
fetch('audio/index.json')
  .then((r) => (r.ok ? r.json() : null))
  .then((index) => {
    sayManifest = index;
    document.documentElement.classList.toggle('can-say', !!index);
  })
  .catch(() => { /* no audio: phrases stay plain text */ });


$('main').addEventListener('click', (e) => {
  if (!sayManifest || e.target.closest('summary, a, button')) return;
  const host = e.target.closest('.lesson [lang="ca"]');
  if (!host) return;
  const el = host.tagName === 'TABLE' ? e.target.closest('td') : host;
  const clip = el && clipFor(sayManifest, el.textContent);
  if (!clip) return;
  document.querySelectorAll('.speaking').forEach((n) => n.classList.remove('speaking'));
  el.classList.add('speaking');
  player.onended = player.onerror = () => el.classList.remove('speaking');
  player.src = `audio/${clip}`;
  player.play().catch(() => el.classList.remove('speaking'));
});

window.addEventListener('hashchange', route);

// Static texts in index.html name their string in data-i18n (text) or data-i18n-aria (aria-label).
function applyStaticTexts() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
}

const getJson = (url) => fetch(url).then((r) => {
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
});

async function start() {
  const locales = await getJson('locales/index.json');
  lang = locales.default;
  const [uiStrings, course, locale] = await Promise.all([
    getJson(`locales/${lang}/ui.json`),
    getJson('course.json'),
    getJson(`locales/${lang}/catalog.json`),
  ]);
  ui = uiStrings;
  t = createT(ui);
  applyStaticTexts();
  catalog = normalizeCatalog(buildCatalog(course, locale, lang));
  renderNav();
  route();
}

start().catch(() => {
  $('main').innerHTML = `<p class="status">${t('status.catalogError')}</p>`;
});
