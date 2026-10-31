// Conjugation trainer (BACKLOG I-12): checking a form letter by letter, hints, the pool of tasks,
// the queue of mistakes and the day's count. Runs on the real data (content/verbs/verbs.json).
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verbIndex } from '../src/services/verbs.ts';
import {
  DEFAULT_TRAINER, answersFor, candidates, checkTyping, finishTask, hint, isRegular, keepTyping, nextTask, parseTrainer, startDay, taskKey,
  type Task,
} from '../src/services/trainer.ts';
import type { VerbsData } from '../src/types/index.ts';

const data: VerbsData = JSON.parse(readFileSync('content/verbs/verbs.json', 'utf8'));
const index = verbIndex(data, { anar: 'идти' });
const verb = (id: string) => index.byId.get(id)!;
const task = (v: string, tense: Task['tense'], person: number): Task => ({ verb: v, tense, person, key: taskKey(v, tense, person) });

// Typing ------------------------------------------------------------------------------------

test('letters: right, right but for the accent, wrong; the first wrong one is reported', () => {
  const c = checkTyping('servia', ['servíem']);
  assert.deepEqual(c.letters, ['ok', 'ok', 'ok', 'ok', 'almost', 'bad']);
  assert.equal(c.bad, 5);
  assert.equal(c.done, null);
});

test('a finished form: exact, or "almost" when only accents differ; case does not matter', () => {
  assert.equal(checkTyping('servíem', ['servíem']).done, 'exact');
  assert.equal(checkTyping('Serviem', ['servíem']).done, 'almost');
  assert.equal(checkTyping('servíe', ['servíem']).done, null);
});

test('a dot stands for the middle dot of l·l, and counts as right; so does the real one', () => {
  assert.equal(checkTyping('col.laboro', ['col·laboro']).done, 'exact');
  assert.equal(checkTyping('col·laboro', ['col·laboro']).done, 'exact');
  assert.deepEqual(checkTyping('col.', ['col·laboro']).letters, ['ok', 'ok', 'ok', 'ok']);
});

test('typographic apostrophes are the same as the straight one', () => {
  assert.equal(checkTyping('m’adono', ["m'adono"]).done, 'exact');
});

test('alternative forms: any of them is right; the one typed so far is followed', () => {
  assert.equal(checkTyping('vares cantar', ['vas cantar', 'vares cantar']).done, 'exact');
  const c = checkTyping('var', ['vas cantar', 'vares cantar']);
  assert.equal(c.bad, -1);
  assert.equal(c.target, 'vares cantar');
});

test('nothing can be typed after the first wrong letter', () => {
  assert.equal(keepTyping('servxa', ['servíem']), 'servx');
  assert.equal(keepTyping('servi', ['servíem']), 'servi');
  assert.equal(keepTyping('servíemxx', ['servíem']), 'servíem'); // not longer than the form
});

test('a hint fixes the first wrong letter or adds the next one', () => {
  assert.equal(hint('', ['vaig anar']), 'v');
  assert.equal(hint('vai', ['vaig anar']), 'vaig');
  assert.equal(hint('vx', ['vaig anar']), 'va');
  assert.equal(hint('servi', ['servíem']), 'serví'); // a letter without its accent is fixed too
  assert.equal(hint('vaig anar', ['vaig anar']), 'vaig anar');
});

// Tasks -------------------------------------------------------------------------------------

test('answers: all six persons, compound and periphrastic tenses, pronominal verbs', () => {
  assert.deepEqual(answersFor(verb('servir'), 'ind.imperf', 3), ['servíem']);
  assert.deepEqual(answersFor(verb('anar'), 'ind.perif', 0), ['vaig anar']);
  assert.deepEqual(answersFor(verb('cantar'), 'ind.perif', 1), ['vas cantar', 'vares cantar']);
  assert.deepEqual(answersFor(verb('dutxar-se'), 'ind.pres', 0), ['em dutxo']);
  assert.deepEqual(answersFor(verb('ser'), 'imp', 1), ['sigues']);
});

test('regular verbs: -ar verbs but anar and estar, and the regular -ir/-er/-re models', () => {
  for (const id of ['cantar', 'parlar', 'començar', 'menjar', 'servir', 'dormir']) assert.ok(isRegular(verb(id)), id);
  for (const id of ['anar', 'estar', 'ser', 'fer', 'tenir', 'venir', 'dir', 'sortir', 'beure']) assert.ok(!isRegular(verb(id)), id);
});

test('the pool: chosen tenses × persons × the most frequent verbs, without empty forms and the non-personal forms', () => {
  const pool = candidates(index.verbs, ['ind.pres', 'nonpers'], { ...DEFAULT_TRAINER.settings, limit: 100 });
  assert.ok(pool.every((t) => t.tense === 'ind.pres'));
  assert.ok(pool.every((t) => index.byId.get(t.verb)!.rank <= 100));
  assert.ok(!pool.some((t) => t.verb === 'ploure' && t.person === 0)); // impersonal: third persons only
  const persons = candidates(index.verbs, ['ind.pres'], { ...DEFAULT_TRAINER.settings, persons: [true, false, false, false, false, false], limit: 300 });
  assert.ok(persons.every((t) => t.person === 0));
  assert.ok(persons.length > 290 && persons.length < 300, 'impersonal verbs have no "jo"');
});

test('the pool: the imperative has no "jo"; regular or irregular verbs only; one verb', () => {
  const imp = candidates(index.verbs, ['imp'], { ...DEFAULT_TRAINER.settings, limit: 100 });
  assert.ok(imp.length > 0 && !imp.some((t) => t.person === 0));
  const irregular = candidates(index.verbs, ['ind.pres'], { ...DEFAULT_TRAINER.settings, kinds: { regular: false, irregular: true } });
  assert.ok(irregular.length > 0 && irregular.every((t) => !isRegular(verb(t.verb))));
  const one = candidates(index.verbs, ['ind.pres', 'ind.fut'], DEFAULT_TRAINER.settings, 'anar');
  assert.equal(one.length, 12);
});

test('the next task: not the same twice in a row; a mistake comes back after a few tasks', () => {
  const pool = [task('anar', 'ind.pres', 0), task('fer', 'ind.pres', 0), task('ser', 'ind.pres', 0)];
  let state = startDay(DEFAULT_TRAINER, '2026-10-31');
  const first = nextTask(pool, state, () => 0)!;
  assert.equal(first.key, pool[0]!.key);
  state = finishTask(state, first, 'missed', 'vaig');
  assert.notEqual(nextTask(pool, state, () => 0)!.key, first.key);
  for (const t of [pool[1]!, pool[2]!]) state = finishTask(state, t, 'exact', '');
  assert.equal(nextTask(pool, state, () => 0.99)!.key, first.key, 'the mistake is due again');
});

test('the day: counts, resets on a new date, keeps the mistakes for the summary', () => {
  let state = startDay(DEFAULT_TRAINER, '2026-10-31');
  state = finishTask(state, task('anar', 'ind.pres', 0), 'exact', 'vaig');
  state = finishTask(state, task('servir', 'ind.imperf', 3), 'almost', 'servíem');
  state = finishTask(state, task('fer', 'ind.pres', 0), 'missed', 'faig');
  assert.deepEqual([state.day.done, state.day.exact, state.day.almost, state.day.missed], [3, 1, 1, 1]);
  assert.deepEqual(state.day.review.map((r) => r.form), ['servíem', 'faig']);
  const next = startDay(state, '2026-11-01');
  assert.equal(next.day.done, 0);
  assert.equal(startDay(state, '2026-10-31').day.done, 3, 'the same day goes on');
});

test('saved trainer state is untrusted: unknown values fall back to the defaults', () => {
  assert.deepEqual(parseTrainer(undefined), DEFAULT_TRAINER);
  assert.deepEqual(parseTrainer('x'), DEFAULT_TRAINER);
  const t = parseTrainer({ settings: { persons: [true, 'no'], limit: 7, goal: 50, kinds: { regular: false, irregular: false } },
    day: { date: '2026-10-31', done: 4, exact: 4, almost: 0, missed: 0, review: [{ key: 'x', form: 1 }] }, queue: [{ key: 1 }] });
  assert.deepEqual(t.settings.persons, DEFAULT_TRAINER.settings.persons);
  assert.equal(t.settings.limit, DEFAULT_TRAINER.settings.limit);
  assert.equal(t.settings.goal, 50);
  assert.deepEqual(t.settings.kinds, DEFAULT_TRAINER.settings.kinds, 'both kinds off is not a choice');
  assert.equal(t.day.done, 4);
  assert.deepEqual(t.day.review, []);
  assert.deepEqual(t.queue, []);
});
