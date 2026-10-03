# Quadern de català

[![CI and Pages](https://github.com/robinsout/crema-catalana/actions/workflows/pages.yml/badge.svg?branch=master)](https://github.com/robinsout/crema-catalana/actions/workflows/pages.yml)
[![Website](https://img.shields.io/website?url=https%3A%2F%2Frobinsout.github.io%2Fcrema-catalana%2F&label=site)](https://robinsout.github.io/crema-catalana/)
[![Node](https://img.shields.io/badge/node-24-339933?logo=nodedotjs&logoColor=white)](.nvmrc)
[![Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)](package.json)
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

Нужны Node 24 (версия в `.nvmrc`) и Python 3 для локального сервера. Внешних зависимостей у проекта нет.

```sh
nvm use                                # Node из .nvmrc
git config core.hooksPath .githooks    # проверки перед каждым пушем
npm test                               # тесты (node:test)
npm run check                          # тесты + сборка в _site/
npm run serve                          # сборка и сайт на http://localhost:8000
npm run audio                          # записать озвучку новых фраз (нужен edge-tts)
```

Новый код пишется через TDD: сначала падающий тест в `tests/`, потом изменение.

## Структура

```
portal/
  index.html          разметка и стили
  js/                 storage.js · model.js · say.js · app.js
  lessons.json        курс, учебный план, список уроков
  content/<id>.html   уроки (HTML-фрагменты)
  audio/              озвучка: index.json и clips/<hash>.mp3 (одна запись на фразу)
scripts/              сборка сайта и генератор озвучки
tests/                тесты логики, данных и сборки
```

Как добавить урок, описано в [CLAUDE.md](CLAUDE.md). Планы развития — в [BACKLOG.md](BACKLOG.md).

## CI/CD

Workflow [`pages.yml`](.github/workflows/pages.yml) на каждый пуш и pull request запускает тесты и сборку. Из ветки `master` сайт публикуется на GitHub Pages, но только если тесты прошли. Локально те же проверки выполняет хук [`.githooks/pre-push`](.githooks/pre-push).

## Совместимость сохранённого прогресса

Ключ `quadern-catala` в localStorage и формат `{ done: { id: bool }, last: id }` не меняются. Id опубликованных уроков постоянные (`tests/published-ids.json`); переименования проходят через `ID_ALIASES` и покрываются тестами на данных старых версий.

## Лицензия

[MIT](LICENSE)
