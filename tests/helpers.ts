// Test helpers: a fake site (fetch over in-memory course data) and saved progress.
import { vi } from 'vitest';
import type { Course, LocaleCatalog, LocalesIndex, UiStrings } from '../src/types/index.ts';
import { STORAGE_KEY } from '../src/services/progress.ts';
import { createHandler } from '../server/app.ts';
import { SqliteBlobStore } from '../server/store.ts';
import { RateLimiter } from '../server/ratelimit.ts';

// The real sync server handler with an in-memory database; share one between "devices" in a test.
export const SYNC_URL = 'https://188.245.182.47';
export function syncServer() {
  return createHandler({ store: new SqliteBlobStore(':memory:'), allowedOrigins: [], limiter: new RateLimiter({ limit: 10_000, windowMs: 60_000 }) });
}
let currentSync: ReturnType<typeof syncServer> | null = null;
export function useSyncServer(server: ReturnType<typeof syncServer>): void { currentSync = server; }

export const course: Course = {
  course: { title: 'Passos 1', publisher: 'Octaedro', level: 'Bàsic 1–3 · A2' },
  extras: [
    { id: 'intro', kind: 'overview', title: 'Introducció' },
    { id: 'x-temps', kind: 'overview', title: 'Els temps', related: ['b1-01'] },
  ],
  parts: [{ id: 'b1', title: 'Bàsic 1', units: [
    { id: 'b1-01', unit: 1, title: 'Hola, soc la Maria', hasVocab: true },
    { id: 'b1-02', unit: 2, title: 'Aquesta és la meva família' },
  ] }],
};

export const ruCatalog: LocaleCatalog = {
  parts: { b1: { period: 'октябрь — декабрь', focus: 'Настоящее время' } },
  lessons: {
    intro: { subtitle: 'Обзор', date: '2026-10-03' },
    'x-temps': { subtitle: 'Времена', date: '2026-10-03' },
    'b1-01': { topic: 'Знакомство', grammar: ['ser'], vocab: 'Приветствия', extra: 'Алфавит', mission: 'Представьтесь', date: '2026-10-10' },
    'b1-02': { topic: 'Семья', grammar: ['tenir'], vocab: 'Семья', extra: 'Числа', mission: 'Дерево' },
  },
};

export const ruUi: UiStrings = {
  _dateLocale: 'ru-RU',
  'progress.done': 'Пройдено: {done} из {ready}',
  'progress.ready': 'Готово уроков: {ready} из {total}',
  'label.unit': '{part} · Unitat {unit}',
  'label.overview': 'Обзорный урок',
  'label.topic': 'Тематический урок',
  'lesson.markDone': 'Отметить как пройденный',
  'lesson.isDone': '✓ Урок пройден',
  'pill.soon': 'Урок появится',
  'pill.open': 'Открыть урок →',
  'pill.done': '✓ Пройден',
  'vocab.title': 'Слова урока',
  'ex.check': 'Проверить',
  'ex.retry': 'Ещё раз',
  'ex.score': 'Верно: {score} из {total}',
  'ex.last': 'Последний результат: {score} из {total}',
  'ex.solution': 'Ответ:',
  'ex.accent': 'проверьте ударения',
  'sync.enable': 'Включить синхронизацию',
  'sync.join': 'Подключить',
  'sync.badCode': 'Код не подходит',
  'sync.disable': 'Отключить на этом устройстве',
};

export const locales: LocalesIndex = { base: 'ru', default: 'ru', available: ['ru'] };

export const lessonHtml = (id: string): string =>
  `<section id="s1"><h2>1. Раздел ${id}</h2><p><span lang="ca">Bon dia</span></p>` +
  (id === 'x-temps' ? '<div data-exercise="fill1"></div><div data-exercise="pick"></div>' : '') +
  '</section>';

export const exercises = {
  fill1: { type: 'fill', items: [
    { prompt: '<span lang="ca">Ahir ___ (anar) al mercat.</span>', answers: ['vaig anar'] },
    { prompt: '<span lang="ca">On ___ el metro?</span>', answers: ['és'] },
    { prompt: '<span lang="ca">Demà ___ sol.</span>', answers: ['farà'], hint: 'futur' },
  ] },
  pick: { type: 'choice', items: [
    { prompt: '<span lang="ca">Avui he menjat.</span>', options: ['perfet', 'imperfet'], answer: 0, explain: 'avui → perfet' },
  ] },
};

// Serves the fake site through global fetch; returns the list of requested urls.
export function stubSite(overrides: Record<string, unknown> = {}): string[] {
  const files: Record<string, unknown> = {
    'locales/index.json': locales,
    'course.json': course,
    'locales/ru/catalog.json': ruCatalog,
    'locales/ru/ui.json': ruUi,
    'audio/index.json': { clips: { 'Bon dia': 'clips/abc.mp3', 'el dilluns': 'clips/def.mp3' } },
    'locales/ru/exercises/x-temps.json': exercises,
    'vocab/b1-01.json': { groups: [{ id: 'dies', words: [{ id: 'dilluns', ca: 'el dilluns', gender: 'm' }, { id: 'tardor', ca: 'la tardor', gender: 'f' }] }] },
    'locales/ru/vocab/b1-01.json': { groups: { dies: 'Дни' }, words: { dilluns: { tr: 'понедельник' }, tardor: { tr: 'осень', note: 'не otoño' } } },
    ...overrides,
  };
  const requested: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    requested.push(url);
    if (url.startsWith(SYNC_URL)) {
      currentSync ??= syncServer();
      return currentSync(new Request(url, init), 'test');
    }
    const lesson = /^locales\/(\w+)\/lessons\/([\w-]+)\.html$/.exec(url);
    if (lesson) return new Response(lessonHtml(lesson[2] ?? ''), { status: 200 });
    if (!(url in files)) return new Response('not found', { status: 404 });
    return new Response(JSON.stringify(files[url]), { status: 200 });
  }));
  return requested;
}

export function saveProgress(json: string): void {
  localStorage.setItem(STORAGE_KEY, json);
}
