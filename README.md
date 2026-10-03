# Quadern de català

[![CI and Pages](https://github.com/robinsout/crema-catalana/actions/workflows/pages.yml/badge.svg?branch=master)](https://github.com/robinsout/crema-catalana/actions/workflows/pages.yml)
[![Website](https://img.shields.io/website?url=https%3A%2F%2Frobinsout.github.io%2Fcrema-catalana%2F&label=site)](https://robinsout.github.io/crema-catalana/)
[![Node](https://img.shields.io/badge/node-24-339933?logo=nodedotjs&logoColor=white)](.nvmrc)
[![Vue](https://img.shields.io/badge/vue-3-42b883?logo=vuedotjs&logoColor=white)](package.json)
[![TypeScript](https://img.shields.io/badge/typescript-strict-3178c6?logo=typescript&logoColor=white)](tsconfig.json)
[![Last commit](https://img.shields.io/github/last-commit/robinsout/crema-catalana)](https://github.com/robinsout/crema-catalana/commits/master)
[![License](https://img.shields.io/github/license/robinsout/crema-catalana)](LICENSE)

Личный учебник каталанского языка: уроки к курсу **Passos 1** (Octaedro, уровни Bàsic 1–3, A2) для русскоязычного ученика, который знает испанский.

**Сайт:** https://robinsout.github.io/crema-catalana/

## Что внутри

- **Учебный план** по 29 юнитам учебника: тема, грамматика, лексика, культура и «миссия» — задание по-каталански в реальной жизни.
- **Две линии уроков:** уроки к юнитам, чтобы закреплять пройденное на занятиях, и тематические или обзорные уроки по запросу.
- **Озвучка:** нажмите на каталанское слово или фразу, и прозвучит запись нейросетевого голоса ca-ES-JoanaNeural.
- **Наглядные схемы:** карта времён на временной оси, циферблаты для системы «quarts», полоса суток, календарь праздников.
- **Прогресс** хранится в браузере; формат сохранённых данных обратно совместим.

## Разработка

Стек: Vue 3 + vue-router + Pinia, TypeScript (strict), Vite, Vitest. Нужен Node 24 (версия в `.nvmrc`).

```sh
nvm use                                # Node из .nvmrc
npm ci                                 # зависимости
git config core.hooksPath .githooks    # хуки: типы перед коммитом, полная проверка перед пушем
npm run dev                            # сайт с горячей перезагрузкой
npm run check                          # типы (vue-tsc) + тесты (Vitest) + сборка в dist/
npm run audio                          # записать озвучку новых фраз (нужен edge-tts)
```

Новый код пишется через TDD: сначала падающий тест в `tests/`, потом изменение.

## Структура

```
index.html                    страница (точка входа Vite)
src/
  main.ts, App.vue, router.ts   приложение и маршруты (/:lang/plan, /:lang/lesson/:id)
  views/, components/           экраны и компоненты Vue
  stores/                       Pinia: progress, catalog, toc
  composables/                  useI18n, useSay, useLessonLink
  lib/                          чистая логика без Vue: types, storage, model, i18n, say
  styles/main.css               стили
content/                      данные курса, копируются на сайт как есть
  course.json                   структура курса: id, юниты, связи (без текстов)
  locales/<lang>/               язык ученика: ui.json, catalog.json, lessons/<id>.html
  audio/                        озвучка: index.json и clips/<hash>.mp3 (одна запись на фразу)
scripts/                      генератор озвучки (TypeScript, запускается Node напрямую)
tests/                        тесты логики, данных, сторов, роутера, интерфейса и сборки
```

Как добавить урок, описано в [CLAUDE.md](CLAUDE.md). Планы развития — в [BACKLOG.md](BACKLOG.md).

## CI/CD

Workflow [`pages.yml`](.github/workflows/pages.yml) на каждый пуш и pull request запускает `npm run check`: проверку типов, тесты и сборку. Из ветки `master` сайт публикуется на GitHub Pages, но только если всё прошло. Локально хук [`.githooks/pre-commit`](.githooks/pre-commit) проверяет типы, а [`.githooks/pre-push`](.githooks/pre-push) выполняет полную проверку.

## Совместимость сохранённого прогресса

Ключ `quadern-catala` в localStorage и формат `{ done: { id: bool }, last: id }` не меняются. Id опубликованных уроков постоянные (`tests/published-ids.json`); переименования проходят через `ID_ALIASES` и покрываются тестами на данных старых версий.

## Лицензия

[MIT](LICENSE)
