// Test helpers: a fake site (fetch over in-memory course data) and saved progress.
import { vi } from 'vitest';
import type { Course, LocaleCatalog, LocalesIndex, UiStrings } from '../src/lib/types.ts';
import { STORAGE_KEY } from '../src/lib/storage.ts';

export const course: Course = {
  course: { title: 'Passos 1', publisher: 'Octaedro', level: 'Bàsic 1–3 · A2' },
  extras: [
    { id: 'intro', kind: 'overview', title: 'Introducció' },
    { id: 'x-temps', kind: 'overview', title: 'Els temps', related: ['b1-01'] },
  ],
  parts: [{ id: 'b1', title: 'Bàsic 1', units: [
    { id: 'b1-01', unit: 1, title: 'Hola, soc la Maria' },
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
};

export const locales: LocalesIndex = { base: 'ru', default: 'ru', available: ['ru'] };

export const lessonHtml = (id: string): string =>
  `<section id="s1"><h2>1. Раздел ${id}</h2><p><span lang="ca">Bon dia</span></p></section>`;

// Serves the fake site through global fetch; returns the list of requested urls.
export function stubSite(overrides: Record<string, unknown> = {}): string[] {
  const files: Record<string, unknown> = {
    'locales/index.json': locales,
    'course.json': course,
    'locales/ru/catalog.json': ruCatalog,
    'locales/ru/ui.json': ruUi,
    'audio/index.json': { clips: { 'Bon dia': 'clips/abc.mp3' } },
    ...overrides,
  };
  const requested: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    requested.push(url);
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
