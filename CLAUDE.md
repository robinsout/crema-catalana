# Quadern de català

Личный портал с уроками каталанского к курсу Passos 1 (Octaedro, Bàsic 1–3, A2).
- Сайт: https://robinsout.github.io/crema-catalana/ (GitHub Pages) — единственное место публикации.
- Старая копия в claude.ai Artifact (https://claude.ai/artifact/CweuEQKKz9GLPtxfS7riYc) больше не поддерживается: не обновлять и не публиковать туда уроки.

## Бэклог
Фичи и идеи — в `BACKLOG.md` (статусы, архитектура, флоу). Перед работой над фичей сверяться с ним и обновлять статус.

## Две линии уроков
1. **Уроки по юнитам** (`parts[].units[]` в `lessons.json`, id вида `b1-04`). Пользователь просит урок к юниту, который прошёл в школе. Основа — план юнита: `topic`, `grammar`, `vocab`, `extra`, `mission`.
2. **Тематические и обзорные уроки** (`extras[]`, id вида `x-pronoms-febles`; `kind`: `topic` или `overview`). Пишутся по запросу; полем `related` урок связывается с юнитами. Вводный урок лежит в `extras` с id `intro`.

## Структура
Стек: Vue 3 + vue-router (режим hash) + Pinia, TypeScript strict, Vite, Vitest.

**Слои** (импорты только вниз; проверяет `tests/architecture.test.ts` — расширять его, а не обходить):
1. `src/api/` — только ввод-вывод: `http.ts` (`getJson`, `getText`), `content.ts` (файлы курса), `storage.ts` (localStorage). **`fetch` и localStorage — только здесь.**
2. `src/services/` — бизнес-логика без Vue: `catalog.ts` (каталог, `buildCatalog`, `resolveRoute`, валидация), `progress.ts` (формат сохранений, контракт совместимости, `markDone`, `mergeProgress`), `content.ts` (что загружать для курса, языка, урока, озвучки), `i18n.ts`, `audio.ts`. Скрипты и будущий сервер синхронизации используют этот слой.
3. `src/stores/` — Pinia, работают только через сервисы: `catalog` (курс + язык, геттеры для интерфейса), `progress` (без плагинов автосохранения), `lessons` (содержимое, словарь и упражнения уроков с кешем), `exercises` (проверка ответов, результаты), `audio` (индекс озвучки), `toc`.
4. Интерфейс — `src/views/`, `src/components/`, `src/composables/` (`useI18n`, `useSay`, `useLessonLink`), `App.vue`: только сторы и composables, никакой логики данных.
- `src/types/` — общие контракты данных, доступны всем слоям.
- `src/router.ts`, `src/main.ts` — сборка приложения (могут использовать сервисы и сторы). Роутер: `/:lang/plan/:focus?`, `/:lang/lesson/:id`; старые ссылки и сохранённый последний экран — через `resolveRoute`.
- `content/` — данные, копируются на сайт как есть (Vite `publicDir`):
  - `course.json` — **структура курса**, одинаковая для всех языков: id, юниты, модули, связи `related`, `kind`, каталанские названия (`title`);
  - `locales/index.json` — `base` (язык-исходник, сейчас `ru`), `default`, `available`;
  - `locales/<lang>/ui.json` — строки интерфейса (ключи `_…` — настройки, например `_dateLocale`). В коде строки только через `t('key')`: тест сверяет использованные и объявленные ключи;
  - `locales/<lang>/catalog.json` — тексты плана: `parts.<id>` (`period`, `focus`) и `lessons.<id>` (`subtitle` или `topic`, `grammar`, `vocab`, `extra`, `mission`, `date`). **Урок готов на языке, когда у него есть `date`**;
  - `locales/<lang>/lessons/<id>.html` — урок в виде HTML-фрагмента. Файл существует ⇔ есть `date` (тест);
  - `vocab/<id>.json` и `locales/<lang>/vocab/<id>.json` — словарь урока: каталанские слова (общие) и перевод;
  - `locales/<lang>/exercises/<id>.json` — интерактивные упражнения урока;
  - `audio/index.json` + `audio/clips/<hash>.mp3` — общее хранилище озвучки: одна запись на фразу.
- `scripts/gen-audio.ts`, `scripts/gen-icons.ts` (`npm run icons`: PNG-иконки из `content/favicon.svg`), `scripts/lib/` — TypeScript, запускается `node` напрямую (Node 24 убирает типы сам).

## Как добавить урок
1. Новый id: добавить в `content/course.json` (в `extras` или юнит в `parts`) и в `tests/published-ids.json`. Id вечные.
2. Создать `content/locales/ru/lessons/<id>.html`. Каждый раздел — `<section id="...">` с `<h2>`, из них строится оглавление.
3. Урок — обычный HTML (не Vue), чтобы его можно было адаптировать на другие языки без знания фреймворка. Разметка, которую понимают стили: `.tw > table`, `table.conj`, `aside.tip|warn|ru` с `<p class="label">`, `.ex`, `.ipa`, `.wrong`, `blockquote.reading`, `<details><summary>`, а также схемы `.tmap`, `ol.story`, `.quarts`, `.daybar`, `.year`.
4. Каталанский текст помечается `lang="ca"` (span, td, li, p, blockquote; если `lang="ca"` стоит на `<table>`, озвучивается каждая ячейка `td`). Русские пояснения держать вне `lang="ca"`, вложенные `lang="ca"` не делать.
5. В `content/locales/ru/catalog.json` → `lessons.<id>`: тексты и `date`.
5a. Словарь урока (по желанию): в `content/course.json` уроку `"hasVocab": true`; каталанская часть — `content/vocab/<id>.json` (`groups[].words[]`: `id`, `ca` с артиклем, `gender` m/f/mf, `plural`); перевод — `content/locales/<lang>/vocab/<id>.json` (`groups.<id>` — название группы, `words.<id>` — `tr`, `note`). Раздел «Слова урока» появляется в конце урока сам; тесты проверяют полноту перевода и озвучку слов.
5b. Интерактивные упражнения (по желанию): в HTML урока на месте упражнения — `<div data-exercise="<id>"></div>`; данные — `content/locales/<lang>/exercises/<lesson id>.json`: `{ "<id>": { "type": "fill", "items": [{ "prompt": "<span lang=\"ca\">Ahir ___ (anar)…</span>", "answers": ["vaig anar"], "hint": "…" }] } }` или `"type": "choice"` с `options` и `answer` (индекс), `explain`. В `fill` первый ответ показывается как решение; варианты регистра, пробелов, апострофов и `l.l` принимаются сами, ошибка только в ударениях — «почти». Свободный перевод с множеством вариантов оставлять со спойлером `<details>`. Тесты сверяют блоки в уроке с данными и озвучку подсказок и ответов.
6. `npm run audio` — записать озвучку (нужен edge-tts: `pip install edge-tts` или `EDGE_TTS=/путь/к/edge-tts`). Голос ca-ES-JoanaNeural.
7. `npm run check`, коммит, пуш. Целостность урока (файл, разделы, озвучка всех фраз, тексты) проверяют тесты.

## Разработка
- **TDD**: сначала тест в `tests/` (Vitest; утверждения через `node:assert/strict`), убедиться, что он падает, потом код. Тесты интерфейса монтируют `App` с роутером на `createMemoryHistory` и тестовым «сайтом» из `tests/helpers.ts` (подмена `fetch`).
- **Совместимость localStorage**: ключ `quadern-catala` и формат `{ done: {id: bool}, last: id }` не меняются. С v3 добавлено `doneAt: {id: ms}` — время последнего изменения отметки (для `mergeProgress`); с v4 — `exercises: {"<урок>/<упражнение>": {score, total, at}}`, последний результат. Новое — только новыми полями; неизвестные поля сохраняются. Опубликованные id уроков вечные (`tests/published-ids.json`); переименование — только через `ID_ALIASES` в `storage.ts` с тестом на старые данные. Старые ссылки (`#b1-04`, `#intro`, `#pla`, `l01`) покрыты тестами роутера.
- `npm run check` = `vue-tsc` + тесты + сборка; так же в CI. Хуки (`git config core.hooksPath .githooks`): `pre-commit` — проверка типов, `pre-push` — полная проверка (кроме пуша одной документации). Оба переключаются на Node из `.nvmrc` через nvm.
- **TypeScript закреплён на 6.x**: `vue-tsc` пока не поддерживает TypeScript 7 (новый компилятор на Go). Не обновлять, пока vue-tsc не заявит поддержку.
- Импорты внутри `src/lib` и `scripts` — с расширением `.ts` (их запускает Node без сборки); синтаксис только стираемый (`erasableSyntaxOnly`: без enum, namespace).
- `npm run dev` — сайт с горячей перезагрузкой; `npm run preview` — собранный `dist/`.
- **Закрытие сессии** — скилл `/close-session` (`.claude/skills/close-session/SKILL.md`): коммиты, проверки, пуш и ожидание деплоя, бэклог, память. Его механическая часть — `npm run session` (`scripts/session-check.ts`, только читает): git и окружение, `npm run check`, уязвимости, CI и открытые PR, совпадение живого сайта со сборкой, сервер синхронизации (health, сертификат, сервисы по SSH, диск), бэклог, индекс памяти. Проверки — только нужные изменениям (`planChecks` в `scripts/lib/session.ts`): нет изменений или только документация (`*.md`, `.claude/`, `LICENSE`) — без тестов; затронут вид — со скриншотами. Тот же список документации пропускают хук `pre-push` (`scripts/plan-checks.ts`) и CI (`paths-ignore`, тест сверяет). Флаги: `--full`, `--no-build`, `--e2e`, `--visual`, `--offline`.
- **Тесты в браузере (Playwright, `e2e/`)**: проекты `desktop` (Chromium 1280×900) и `phone` (iPhone 13, WebKit), сервер — `vite preview` собранного сайта.
  - `npm run e2e` — функциональные: старые ссылки, прогресс прошлых версий, прокрутка к юниту, озвучка по клику, шрифты без внешних запросов, нет горизонтальной прокрутки, навигация. Запускаются в `pre-push` и в CI.
  - `npm run e2e:visual` — скриншоты плана и уроков (светлая/тёмная тема, компьютер/телефон) с эталонами в `e2e/visual.spec.ts-snapshots/` (`-darwin`). **Только локально**: macOS и Linux рисуют шрифты по-разному. После намеренного изменения вида: `npm run e2e:visual:update`, просмотреть новые снимки и закоммитить. Порог — 0,1% пикселей.
  - Проверять вёрстку через Playwright, а не голым headless Chrome (он не умеет узкие окна, ожидания и прокрутку).
- Шрифты подключены из `@fontsource/*` и раздаются вместе с сайтом; к Google Fonts сайт не обращается (проверяет e2e).
- Node 24 (версия в `.nvmrc`; на машине стоит nvm, `nvm use` в папке проекта). CI берёт версию из того же `.nvmrc`.

## Содержание
Пишем на русском, сравниваем с испанским, французским и русским. Вариант языка — центральный (барселонский), орфография по реформе IEC 2016 (soc, dona, vens; диакритик осталось 15).

## Синхронизация
- Клиент: `src/services/sync.ts` (код, HKDF, AES-GCM, цикл слияния), `src/api/sync.ts` (адрес из `VITE_SYNC_URL`, по умолчанию `https://188.245.182.47`), стор `sync`, экран `#/<lang>/sync/:code?`. **Синхронизация только по кнопкам** (включить, подключить, «Синхронизировать сейчас») — так решил пользователь: никаких фоновых и автоматических запросов (тесты считают запросы к серверу). Код хранится отдельно от прогресса (localStorage `quadern-sync`) и сам не синхронизируется. На сервер уходят только `done`, `doneAt`, `exercises` — зашифрованными.
- Сервер: `server/` (портативный обработчик `Request → Response` + `node:sqlite` + `node:http`), контракт — `shared/sync-api.ts` (слой «типы», общий с сайтом). Тесты сервера — в окружении `node` (`// @vitest-environment node`).
- e2e поднимают локальный сервер синхронизации (`playwright.config.ts`, порт 8787) и собирают сайт с `VITE_SYNC_URL=http://localhost:8787`.
- Эксплуатация, безопасность, лимиты, обновления, деплой (`npm run deploy:sync`) — `deploy/README.md`. Мониторинг — `.github/workflows/monitor.yml`.
- Безопасность сайта: CSP задаётся тегом `<meta>` при сборке (`scripts/lib/csp.ts`, плагин в `vite.config.ts`; новый внешний адрес — только через неё, e2e ловит нарушения); шрифты не встраиваются в CSS как `data:`. Код из ссылки QR роутер сразу переносит в стор (`sync.incoming`) и убирает из адреса. Внутри чужого фрейма действия синхронизации не выполняются (`isFramed`). Прогресс из localStorage и с сервера — непроверенные данные: принимаются только id формата `isLessonId` (новые id уроков и упражнений должны ему соответствовать — тест).
- Все Pages-сайты аккаунта делят origin `robinsout.github.io` (а значит, localStorage с кодом синхронизации): **к ним нельзя подключать сторонние скрипты** (счётчики, виджеты, SDK, CDN) — на этом правиле держится принятый риск M1 (`BACKLOG.md`, S-1). Это касается и других репозиториев аккаунта с Pages.

## Деплой
- Репозиторий: git@github.com:robinsout/crema-catalana.git (ветка `master`). Пушить с личным SSH-ключом `~/.ssh/mygithub`, он прописан в `core.sshCommand` этого репозитория.
- Коммиты делать от личного адреса robinsout@gmail.com (он задан в локальном git config), а не от рабочего.
- `.github/workflows/pages.yml`: `npm ci` + `npm run check` на каждый пуш и PR; деплой `dist/` на Pages только из `master` и только если всё прошло.
