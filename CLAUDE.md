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
- `portal/index.html` — разметка и стили; логика в `portal/js/`:
  - `storage.js` — прогресс в localStorage (контракт совместимости, см. ниже);
  - `model.js` — каталог уроков, маршрутизация, прогресс, валидация;
  - `say.js` — поиск аудиоклипа по фразе;
  - `app.js` — отрисовка страницы.
- `portal/lessons.json` — курс, `extras`, `parts`. Страница «Учебный план» (`#pla`) строится из него. Урок без `file` показывается как «урок появится».
- `portal/content/<id>.html` — урок в виде HTML-фрагмента (без `<html>`/`<head>`/`<body>`).
- `portal/audio/index.json` + `portal/audio/clips/<hash>.mp3` — общее хранилище озвучки: одна запись на фразу для всех уроков и названий на странице плана.

## Как добавить урок
1. Создать `portal/content/<id>.html`. Каждый раздел — `<section id="...">` с `<h2>`, из них строится оглавление.
2. Разметка, которую понимают стили: `.tw > table`, `table.conj`, `aside.tip|warn|ru` с `<p class="label">`, `.ex`, `.ipa`, `.wrong`, `blockquote.reading`, `<details><summary>`.
3. Каталанский текст помечается `lang="ca"` (span, td, li, blockquote; если `lang="ca"` стоит на `<table>`, озвучивается каждая ячейка `td`). Русские пояснения держать вне `lang="ca"`.
4. В `lessons.json` добавить уроку `file` и `date`; id урока добавить в `tests/published-ids.json`.
5. `npm run audio` — записать озвучку (нужен edge-tts: `pip install edge-tts` или `EDGE_TTS=/путь/к/edge-tts`). Голос ca-ES-JoanaNeural.
6. `npm run check`, коммит, пуш. Целостность урока (файл, разделы, озвучка всех фраз) проверяет `tests/catalog.test.js`.

## Разработка
- **TDD**: сначала тест в `tests/` (node:test, без зависимостей), убедиться, что он падает, потом код.
- **Совместимость localStorage**: ключ `quadern-catala` и формат `{ done: {id: bool}, last: id }` не меняются. С v3 добавлено поле `doneAt: {id: ms}` — время последнего изменения отметки, нужно для слияния устройств (`mergeProgress`). Новое добавляется только новыми полями; неизвестные поля сохраняются. Опубликованные id уроков вечные (`tests/published-ids.json`); переименование — только через `ID_ALIASES` в `storage.js` с тестом на старые данные.
- Локальный пайплайн: `npm run check` (тесты + сборка). Хук `.githooks/pre-push` запускает его перед пушем; включается командой `git config core.hooksPath .githooks`.
- `npm run serve` — собрать сайт и открыть на http://localhost:8000.
- Node 24 (версия в `.nvmrc`; на машине стоит nvm, `nvm use` в папке проекта). CI берёт версию из того же `.nvmrc`.

## Содержание
Пишем на русском, сравниваем с испанским, французским и русским. Вариант языка — центральный (барселонский), орфография по реформе IEC 2016 (soc, dona, vens; диакритик осталось 15).

## Деплой
- Репозиторий: git@github.com:robinsout/crema-catalana.git (ветка `master`). Пушить с личным SSH-ключом `~/.ssh/mygithub`, он прописан в `core.sshCommand` этого репозитория.
- Коммиты делать от личного адреса robinsout@gmail.com (он задан в локальном git config), а не от рабочего.
- `.github/workflows/pages.yml`: тесты и сборка на каждый пуш и PR; деплой на Pages только из `master` и только если тесты прошли.
- `portal/index.html` написан без `<html>`/`<head>` (наследие версии для Artifact); каркас добавляет `scripts/build.mjs`.
