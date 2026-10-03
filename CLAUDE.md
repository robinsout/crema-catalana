# Quadern de català

Личный портал с уроками каталанского. Опубликован как Artifact: https://claude.ai/artifact/CweuEQKKz9GLPtxfS7riYc

## Структура
- `portal/index.html` — оболочка: навигация, прогресс (localStorage), оглавление, озвучка через speechSynthesis.
- `portal/lessons.json` — список уроков. У запланированных уроков нет поля `file` (в меню они помечены «скоро»).
- `portal/content/NN-slug.html` — урок в виде HTML-фрагмента без `<html>`/`<head>`. Фрагмент подгружается в оболочку через fetch.

## Как добавить урок
1. Создать `portal/content/NN-slug.html`. Каждый раздел оформляется как `<section id="...">` с `<h2>`, из них строится оглавление.
2. Разметка, которую понимают стили: `.tw > table` (таблица со скроллом), `table.conj` (спряжение), `aside.tip|warn|ru` с `<p class="label">`, `.ex` (пример), `.ipa` (транскрипция), `.wrong` (ошибочная форма), `blockquote.reading`, `<details><summary>` (ответы).
3. Каталанский текст помечается `lang="ca"`, тогда его можно озвучить кликом. Если `lang="ca"` стоит на `<table>`, озвучивается каждая ячейка; русские пояснения держать вне `lang="ca"`.
4. Добавить уроку `file` и `date` в `lessons.json`.
5. Перепубликовать: Artifact publish `portal/index.html`, в `files` передать `lessons.json` и новый фрагмент (уже опубликованные файлы сохраняются).

## Содержание
Пишем на русском, сравниваем с испанским, французским и русским. Вариант языка — центральный (барселонский), орфография по реформе IEC 2016 (soc, dona, vens; диакритик осталось 15).

## Деплой
- Репозиторий: git@github.com:robinsout/crema-catalana.git (ветка `master`). Пушить с личным SSH-ключом `~/.ssh/mygithub`, он прописан в `core.sshCommand` этого репозитория.
- Коммиты делать от личного адреса robinsout@gmail.com (он задан в локальном git config), а не от рабочего.
- `.github/workflows/pages.yml` собирает `portal/` в `_site/` и при каждом пуше в `master` публикует сайт на GitHub Pages: https://robinsout.github.io/crema-catalana/
- `portal/index.html` написан без `<html>`/`<head>`, потому что claude.ai Artifact добавляет их сам. Для Pages этот каркас добавляет workflow.
- Новый урок публиковать в оба места: перепубликовать Artifact и закоммитить с пушем.
