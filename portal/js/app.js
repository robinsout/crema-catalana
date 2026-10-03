// Page layer: renders navigation, the study plan and lessons. Logic lives in model.js and storage.js.
import { createStore } from './storage.js';
import { clipFor } from './say.js';
import {
  PLAN_ID, normalizeCatalog, allLessons, findLesson, resolveRoute,
  progress, neighbours, lessonLabel, relatedExtras,
} from './model.js';

let backend = null;
try { backend = window.localStorage; } catch (e) { backend = null; }
const store = createStore(backend);
let catalog = normalizeCatalog({});
let current = null; // PLAN_ID or lesson id

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const badge = (l) => (l.track === 'unit' ? l.unit : l.kind === 'overview' ? 'О' : 'Т');

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
  let html = `<li><a href="#${PLAN_ID}" class="plan-link"${planCur}><span class="n">☰</span><span><span class="t">Учебный план</span><span class="s">${esc(catalog.course.title || '')} · уроки по юнитам и темам</span></span></a></li>`;
  const extras = lessons.filter((l) => l.track === 'extra');
  if (extras.length) {
    html += '<li class="part-h">Темы и обзоры</li>' + extras.map(item).join('');
  }
  for (const p of catalog.parts) {
    html += `<li class="part-h"><span lang="ca">${esc(p.title)}</span> · ${esc(p.period)}</li>`;
    html += lessons.filter((l) => l.part === p || (l.part && l.part.id === p.id)).map(item).join('');
  }
  $('lessonList').innerHTML = html;
  const pr = progress(catalog, store.state.done);
  $('progressText').innerHTML = `<span>Пройдено: ${pr.done} из ${pr.ready}</span><span>Готово уроков: ${pr.ready} из ${pr.total}</span>`;
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
  if (!l.file) return '<span class="pill">Урок появится</span>';
  return `<a class="pill ok" href="#${l.id}">${store.state.done[l.id] ? '✓ Пройден' : 'Открыть урок →'}</a>`;
}

function unitRow(u) {
  const related = relatedExtras(catalog, u.id);
  const rel = related.length
    ? `<dt>Темы</dt><dd>${related.map((x) => `<a href="#${x.id}" lang="ca">${esc(x.title)}</a>`).join(', ')}</dd>`
    : '';
  return `<div class="unit" id="u-${u.id}">
    <div class="unit-n">${u.unit}</div>
    <div class="unit-body">
      <div class="unit-top"><h3 lang="ca">${esc(u.title)}</h3>${statusPill(u)}</div>
      <p class="unit-topic">${esc(u.topic)}</p>
      <ul class="chips">${(u.grammar || []).map((g) => `<li>${esc(g)}</li>`).join('')}</ul>
      <dl class="unit-dl">
        <dt>Лексика</dt><dd>${esc(u.vocab)}</dd>
        <dt>Дополнительно</dt><dd>${esc(u.extra)}</dd>
        <dt>Миссия</dt><dd>${esc(u.mission)}</dd>
        ${rel}
      </dl>
    </div>
  </div>`;
}

function extraRow(x) {
  const units = (x.related || []).map((id) => findLesson(catalog, id)).filter(Boolean);
  const rel = units.length
    ? `<dl class="unit-dl"><dt>К юнитам</dt><dd>${units.map((u) => `<a href="#${u.id}">${esc(u.part.title)} · ${u.unit}</a>`).join(', ')}</dd></dl>`
    : '';
  return `<div class="unit" id="u-${x.id}">
    <div class="unit-n">${badge(x)}</div>
    <div class="unit-body">
      <div class="unit-top"><h3 lang="ca">${esc(x.title)}</h3>${statusPill(x)}</div>
      <p class="unit-topic">${esc(lessonLabel(x))}${x.subtitle ? ` · ${esc(x.subtitle)}` : ''}</p>
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
      <p class="eyebrow">Учебный план</p>
      <h2 lang="ca">${esc(c.title || 'Passos 1')}${c.level ? ` · ${esc(c.level)}` : ''}</h2>
      <p class="sub">Уроки по юнитам учебника ${esc(c.title || '')}${c.publisher ? ` (${esc(c.publisher)})` : ''} и тематические уроки</p>
    </header>
    <article class="lesson plan">
      <p>Уроки идут двумя параллельными линиями. <strong>Уроки по юнитам</strong> закрепляют то, что прошли на занятии: после урока в школе открывайте урок с тем же номером. В нём грамматика юнита разобрана глубже, с исключениями и сравнением с испанским, есть упражнения и <strong>миссия</strong>, небольшое задание по-каталански в реальной жизни. <strong>Тематические и обзорные уроки</strong> появляются по запросу, когда хочется подробнее разобрать тему или увидеть общую картину.</p>
      <p class="meta">Грамматические темы юнитов восстановлены по их названиям и типовой программе уровня Bàsic. Когда сверите их с оглавлением учебника, план поправим.</p>
      <ol class="parts">
        ${extras.length ? `<li><a href="#" data-sec="extras"><span class="parts-t">Темы</span><span class="parts-p">по запросу</span><span class="parts-f">Тематические и обзорные уроки: ${extras.length}</span></a></li>` : ''}
        ${catalog.parts.map((p) => `
        <li><a href="#" data-sec="${p.id}"><span class="parts-t" lang="ca">${esc(p.title)}</span><span class="parts-p">${esc(p.period)}</span><span class="parts-f">${esc(p.focus)}</span></a></li>`).join('')}
      </ol>
      ${extras.length ? `
      <section id="extras">
        <h2><span>Темы и обзоры</span> <span class="h-period">по запросу</span></h2>
        <p>Дополнительные уроки поверх курса.</p>
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
    $('main').innerHTML = `<p class="status">Не удалось загрузить урок «${esc(lesson.title)}». Обновите страницу.</p>`;
    return;
  }
  if (current !== lesson.id) return;

  const { prev, next } = neighbours(catalog, lesson.id);
  const date = lesson.date ? new Date(lesson.date + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const related = lesson.track === 'unit' ? relatedExtras(catalog, lesson.id).filter((x) => x.file) : [];

  $('main').innerHTML = `
    <header class="lesson-head">
      <p class="eyebrow">${esc(lessonLabel(lesson))}</p>
      <h2 lang="ca">${esc(lesson.title)}</h2>
      <p class="sub">${esc(lesson.subtitle || lesson.topic || '')}</p>
      <div class="head-actions">
        <button class="btn" id="doneBtn" type="button"></button>
        ${date ? `<span class="meta">${date}</span>` : ''}
      </div>
    </header>
    <article class="lesson">${body}</article>
    ${related.length ? `<p class="related">Темы к этому юниту: ${related.map((x) => `<a href="#${x.id}" lang="ca">${esc(x.title)}</a>`).join(', ')}</p>` : ''}
    <nav class="pager" aria-label="Соседние уроки">
      ${prev ? `<a href="#${prev.id}">← ${esc(prev.title)}</a>` : `<a href="#${PLAN_ID}">← Учебный план</a>`}
      ${next ? `<a href="#${next.id}">${esc(next.title)} →</a>` : `<a href="#${PLAN_ID}">Учебный план →</a>`}
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
  b.textContent = d ? '✓ Урок пройден' : 'Отметить как пройденный';
  b.classList.toggle('is-done', d);
}

/* ---------- table of contents ---------- */
let spy;
function buildToc() {
  const secs = [...document.querySelectorAll('.lesson section[id]')];
  $('toc').innerHTML = secs.length ? `<p>${current === PLAN_ID ? 'Разделы' : 'В этом уроке'}</p><ol>${secs.map((s) => {
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

$('sayHint').textContent = 'Нажмите на каталанское слово или фразу, чтобы услышать произношение. Озвучка: нейросетевой голос Joana (ca-ES).';

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

fetch('lessons.json')
  .then((r) => r.json())
  .then((json) => { catalog = normalizeCatalog(json); renderNav(); route(); })
  .catch(() => { $('main').innerHTML = '<p class="status">Не удалось загрузить список уроков. Обновите страницу.</p>'; });
