// Conjugation trainer (BACKLOG I-12): a verb, a person and a tense are shown, the reader types the
// form. Checking letter by letter as it is typed, hints, the pool of tasks (the tenses chosen in the
// verb reference × persons × the most frequent verbs), a queue that brings mistakes back, the day's count.
// The state is saved on this device only (progress field `trainer`, untrusted when read: parseTrainer).
import type { TenseId, VerbDef } from '../types/index.ts';
import { conjugate, type VerbEntry } from './verbs.ts';

// Typing -------------------------------------------------------------------------------------

export type Letter = 'ok' | 'almost' | 'bad';

export interface TypingCheck {
  letters: Letter[]; // one per typed character
  bad: number; // index of the first wrong letter, -1 when none
  done: 'exact' | 'almost' | null; // the whole form is typed: exactly, or with accents missing or wrong
  target: string; // the form being typed (of the alternatives, the one that fits best)
}

const APOSTROPHE = /[’‘`´]/;
const bare = (c: string): string => c.normalize('NFD').replace(/\p{M}/gu, '');

function letter(typed: string, expected: string): Letter {
  const a = typed.toLowerCase();
  const b = expected.toLowerCase();
  if (a === b) return 'ok';
  if (b === '·' && (a === '.' || a === '•')) return 'ok'; // l.l for l·l
  if (b === "'" && APOSTROPHE.test(a)) return 'ok';
  return bare(a) === bare(b) ? 'almost' : 'bad';
}

function lettersOf(typed: string, form: string): Letter[] {
  return [...typed].map((c, i) => (i < form.length ? letter(c, form[i]!) : 'bad'));
}

// how far the typed text fits a form
const fit = (letters: Letter[]): number => { const i = letters.indexOf('bad'); return i < 0 ? letters.length : i; };

export function checkTyping(typed: string, forms: string[]): TypingCheck {
  let best = { letters: [] as Letter[], target: forms[0] ?? '', fit: -1 };
  for (const form of forms) {
    const letters = lettersOf(typed, form);
    const f = fit(letters);
    if (f > best.fit) best = { letters, target: form, fit: f };
  }
  const { letters, target } = best;
  const bad = letters.indexOf('bad');
  const complete = bad < 0 && [...typed].length === [...target].length && typed.length > 0;
  return { letters, bad, target, done: complete ? (letters.includes('almost') ? 'almost' : 'exact') : null };
}

// Typing stops at the first wrong letter and at the length of the form
export function keepTyping(typed: string, forms: string[]): string {
  const c = checkTyping(typed, forms);
  const chars = [...typed];
  const length = [...c.target].length;
  const end = Math.min(c.bad >= 0 && c.bad < length ? c.bad + 1 : chars.length, length);
  return chars.slice(0, end).join('');
}

// The typed text up to the first letter that is not right, plus the right one there
export function hint(typed: string, forms: string[]): string {
  const c = checkTyping(typed, forms);
  const target = [...c.target];
  const at = c.letters.findIndex((l) => l !== 'ok');
  const keep = at < 0 ? c.letters.length : at;
  if (keep >= target.length) return target.join('');
  return [...typed].slice(0, keep).join('') + target[keep];
}

// Tasks --------------------------------------------------------------------------------------

export type TrainerTense = Exclude<TenseId, 'nonpers'>;

export interface Task {
  verb: string; // verb id
  tense: TrainerTense;
  person: number; // 0–5 (in the imperative 1–5)
  key: string;
}

export const taskKey = (verb: string, tense: TenseId, person: number): string => `${verb}|${tense}|${person}`;

export function answersFor(verb: VerbDef, tense: TrainerTense, person: number): string[] {
  return conjugate(verb, tense).find((r) => r.person === person)?.forms ?? [];
}

// All -ar verbs are regular but anar and estar (spelling changes like començo are not irregular);
// of the other conjugations, the regular models
const IRREGULAR_AR = new Set(['anar', 'estar']);
const REGULAR_MODELS = new Set(['servir', 'afegir', 'acomplir', 'dormir', 'abatre', 'témer']);
export function isRegular(verb: VerbDef): boolean {
  if (verb.inf.endsWith('ar')) return !IRREGULAR_AR.has(verb.inf) && !IRREGULAR_AR.has(verb.model ?? '');
  return REGULAR_MODELS.has(verb.model ?? verb.inf);
}

export const LIMITS = [100, 300, 0] as const; // 0: all the verbs
export const GOALS = [10, 25, 50, 100] as const;
export type Limit = (typeof LIMITS)[number];
export type Goal = (typeof GOALS)[number];

export interface TrainerSettings {
  persons: boolean[]; // jo, tu, ell, nosaltres, vosaltres, ells
  limit: Limit;
  kinds: { regular: boolean; irregular: boolean };
  goal: Goal;
}

// Every task that fits the settings; `only`: the tasks of one verb ("practise this verb")
export function candidates(verbs: VerbEntry[], tenses: TenseId[], s: TrainerSettings, only?: string): Task[] {
  const chosen = verbs.filter((v) => (only ? v.id === only
    : (!s.limit || v.rank <= s.limit) && (isRegular(v) ? s.kinds.regular : s.kinds.irregular)));
  const out: Task[] = [];
  for (const v of chosen) {
    for (const tense of tenses) {
      if (tense === 'nonpers') continue;
      for (const row of conjugate(v, tense)) {
        if (row.forms.length && s.persons[row.person]) out.push({ verb: v.id, tense, person: row.person, key: taskKey(v.id, tense, row.person) });
      }
    }
  }
  return out;
}

// The day and the queue of mistakes ---------------------------------------------------------

export type Outcome = 'exact' | 'almost' | 'missed'; // missed: with a hint (a fixed typo is not a mistake)

export interface ReviewItem { key: string; form: string; almost?: boolean }

export interface TrainerDay {
  date: string; // YYYY-MM-DD, local
  done: number;
  exact: number;
  almost: number;
  missed: number;
  review: ReviewItem[]; // to look at again, in the summary of the day
}

export interface TrainerState {
  settings: TrainerSettings;
  day: TrainerDay;
  queue: { key: string; due: number }[]; // mistakes, asked again when `step` reaches `due`
  step: number; // tasks done on this device
  last: string | null; // the last task, not asked twice in a row
}

const AGAIN_AFTER = 2; // a mistake comes back after this many other tasks
const QUEUE_MAX = 50;
const REVIEW_MAX = 100;

const emptyDay = (date: string): TrainerDay => ({ date, done: 0, exact: 0, almost: 0, missed: 0, review: [] });

export const DEFAULT_TRAINER: TrainerState = {
  settings: { persons: [true, true, true, true, true, true], limit: 300, kinds: { regular: true, irregular: true }, goal: 25 },
  day: emptyDay(''),
  queue: [],
  step: 0,
  last: null,
};

export const today = (now: Date = new Date()): string =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

// The same day goes on; a new date starts a new count (the queue of mistakes stays)
export const startDay = (s: TrainerState, date: string): TrainerState => (s.day.date === date ? s : { ...s, day: emptyDay(date) });

export function nextTask(pool: Task[], s: TrainerState, random: () => number = Math.random): Task | null {
  if (!pool.length) return null;
  const byKey = new Map(pool.map((t) => [t.key, t]));
  const due = s.queue.find((q) => q.due <= s.step && q.key !== s.last && byKey.has(q.key));
  if (due) return byKey.get(due.key)!;
  const choice = pool.length > 1 ? pool.filter((t) => t.key !== s.last) : pool;
  return choice[Math.min(choice.length - 1, Math.floor(random() * choice.length))]!;
}

export function finishTask(s: TrainerState, task: Task, outcome: Outcome, form: string): TrainerState {
  const step = s.step + 1;
  const day = { ...s.day, done: s.day.done + 1, [outcome]: s.day[outcome] + 1 };
  if (outcome !== 'exact') day.review = [...s.day.review, { key: task.key, form, ...(outcome === 'almost' ? { almost: true } : {}) }].slice(-REVIEW_MAX);
  let queue = s.queue.filter((q) => q.key !== task.key);
  if (outcome === 'missed') queue = [...queue, { key: task.key, due: step + AGAIN_AFTER }].slice(-QUEUE_MAX);
  return { ...s, day, queue, step, last: task.key };
}

// Saved state --------------------------------------------------------------------------------

type Loose = Record<string, unknown>;
const isObject = (v: unknown): v is Loose => v !== null && typeof v === 'object' && !Array.isArray(v);
const count = (v: unknown): number | undefined => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : undefined);
const isKey = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length < 100;

export function parseTrainer(saved: unknown): TrainerState {
  const d = DEFAULT_TRAINER;
  if (!isObject(saved)) return d;
  const s = isObject(saved.settings) ? saved.settings : {};
  const persons = Array.isArray(s.persons) && s.persons.length === 6 && s.persons.every((p) => typeof p === 'boolean') && s.persons.some(Boolean)
    ? s.persons as boolean[] : d.settings.persons;
  const limit = LIMITS.find((l) => l === s.limit) ?? d.settings.limit;
  const goal = GOALS.find((g) => g === s.goal) ?? d.settings.goal;
  const k = isObject(s.kinds) ? s.kinds : {};
  const kinds = typeof k.regular === 'boolean' && typeof k.irregular === 'boolean' && (k.regular || k.irregular)
    ? { regular: k.regular, irregular: k.irregular } : d.settings.kinds;
  const day = isObject(saved.day) ? saved.day : {};
  const nums = ['done', 'exact', 'almost', 'missed'].map((f) => count(day[f]));
  const review = Array.isArray(day.review)
    ? day.review.filter((r): r is Loose => isObject(r) && isKey(r.key) && typeof r.form === 'string')
      .map((r): ReviewItem => ({ key: r.key as string, form: r.form as string, ...(r.almost === true ? { almost: true } : {}) })).slice(-REVIEW_MAX)
    : [];
  const queue = Array.isArray(saved.queue)
    ? saved.queue.filter((q): q is Loose => isObject(q) && isKey(q.key) && count(q.due) !== undefined)
      .map((q) => ({ key: q.key as string, due: q.due as number })).slice(-QUEUE_MAX)
    : [];
  return {
    settings: { persons, limit, kinds, goal },
    day: typeof day.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day.date) && nums.every((n) => n !== undefined)
      ? { date: day.date, done: nums[0]!, exact: nums[1]!, almost: nums[2]!, missed: nums[3]!, review }
      : d.day,
    queue,
    step: count(saved.step) ?? 0,
    last: isKey(saved.last) ? saved.last : null,
  };
}
