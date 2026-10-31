// Conjugation trainer (BACKLOG I-12): the current task, what is typed, and the steps between tasks.
// typing → (right) pause → next task; typing → (with a hint) review → next.
// A form typed with only accents missing does not finish by itself: the keyboard may still replace the
// last letter (press and hold: "e", then "é"). Next (Enter) takes it as "almost" and goes on.
// A wrong letter stops typing until it is deleted; fixed, it is only a typo and the form counts as right.
// A right form stays on screen for PAUSE_MS; a letter typed meanwhile starts the next task at once.
// When the day's count reaches the goal, a summary comes instead of the next task.
import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';
import {
  answersFor, candidates, checkTyping, finishTask, GOALS, hint as hintOf, keepTyping, LIMITS, nextTask, startDay, today,
  type Goal, type Limit, type Outcome, type Task, type TrainerSettings,
} from '../services/trainer.ts';
import { useProgressStore } from './progress.ts';
import { useVerbsStore } from './verbs.ts';

export type { Goal, Limit, Task };

export const PAUSE_MS = 1200;
export const MORE = 10; // "10 more" after the goal

export type Phase = 'loading' | 'typing' | 'pause' | 'review' | 'summary' | 'rest' | 'empty';

export interface Done { task: Task; form: string; outcome: Outcome }

export const useTrainerStore = defineStore('trainer', () => {
  const progress = useProgressStore();
  const verbs = useVerbsStore();

  const only = ref<string | null>(null); // one verb ("practise this verb")
  const task = shallowRef<Task | null>(null);
  const typed = ref('');
  const hinted = ref<number[]>([]); // letters opened by the hint
  const phase = ref<Phase>('loading');
  const outcome = ref<Outcome | null>(null);
  const previous = shallowRef<Done | null>(null);
  const stopAt = ref(0); // the day's count that brings the summary (0: none)
  let timer: ReturnType<typeof setTimeout> | null = null;

  const settings = computed(() => progress.trainer.settings);
  const state = computed(() => startDay(progress.trainer, today()));
  const day = computed(() => state.value.day);
  const index = computed(() => (verbs.current.state === 'ready' ? verbs.current.index : null));
  const pool = computed(() => (index.value ? candidates(index.value.verbs, progress.verbTenses, settings.value, only.value ?? undefined) : []));
  const verb = computed(() => (task.value ? index.value?.byId.get(task.value.verb) ?? null : null));
  const forms = computed(() => (task.value && verb.value ? answersFor(verb.value, task.value.tense, task.value.person) : []));
  const check = computed(() => checkTyping(typed.value, forms.value));
  // typed in full, only accents missing: waits for the accent or for Next
  const accentPending = computed(() => phase.value === 'typing' && check.value.done === 'almost' && !hinted.value.length);

  function clearTimer(): void {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  function reset(): void {
    clearTimer();
    typed.value = '';
    hinted.value = [];
    outcome.value = null;
  }

  function pick(): void {
    reset();
    if (!index.value) { phase.value = 'loading'; return; }
    task.value = nextTask(pool.value, state.value);
    phase.value = task.value ? 'typing' : 'empty';
  }

  // opens the trainer (again): the goal of the day is still ahead, or already passed
  function start(verbId: string | null): void {
    only.value = verbId;
    const { done } = day.value;
    stopAt.value = done < settings.value.goal ? settings.value.goal : 0;
    pick();
  }

  function finish(result: Outcome): void {
    const t = task.value!;
    outcome.value = result;
    progress.saveTrainer(finishTask(state.value, t, result, check.value.target));
    phase.value = result === 'exact' ? 'pause' : 'review';
    if (result === 'exact') timer = setTimeout(advance, PAUSE_MS);
  }

  function evaluate(): void {
    const c = check.value;
    if (hinted.value.length) { if (c.done) finish('missed'); }
    else if (c.done === 'exact') finish('exact');
  }

  function advance(): void {
    if (task.value && outcome.value) previous.value = { task: task.value, form: check.value.target, outcome: outcome.value };
    if (stopAt.value && day.value.done >= stopAt.value) {
      reset();
      stopAt.value = 0;
      phase.value = 'summary';
      return;
    }
    pick();
  }

  // what the field holds now; between tasks, what is typed beyond the solved form starts the next one
  function input(value: string): void {
    if (phase.value === 'pause' || phase.value === 'review') {
      const extra = value.startsWith(typed.value) ? value.slice(typed.value.length) : value;
      advance();
      if ((phase.value as Phase) === 'typing' && extra) input(extra); // advance() changed it
      return;
    }
    if (phase.value !== 'typing') return;
    typed.value = keepTyping(value, forms.value);
    evaluate();
  }

  // the hint opens the next letter; between tasks the same button goes on
  function hint(): void {
    if (phase.value === 'pause' || phase.value === 'review') { advance(); return; }
    if (phase.value !== 'typing') return;
    const next = hintOf(typed.value, forms.value);
    if (next === typed.value) return;
    typed.value = next;
    hinted.value = [...hinted.value, [...next].length - 1];
    evaluate();
  }

  // after a hint: the whole form at once (a mistake, like the hint)
  function reveal(): void {
    if (phase.value !== 'typing') return;
    const target = [...check.value.target];
    hinted.value = target.map((_, i) => i);
    typed.value = target.join('');
    evaluate();
  }

  function next(): void {
    if (accentPending.value) { finish('almost'); advance(); return; }
    if (phase.value === 'pause' || phase.value === 'review') advance();
  }

  // after the summary: ten more with a new summary, or carry on without one
  function more(): void { stopAt.value = day.value.done + MORE; pick(); }
  function rest(): void { reset(); phase.value = 'rest'; }
  function carryOn(): void { pick(); }

  function setSettings(change: Partial<TrainerSettings>): void {
    const s = { ...settings.value, ...change };
    progress.saveTrainer({ ...progress.trainer, settings: s });
    if (change.goal && phase.value !== 'summary') stopAt.value = day.value.done < s.goal ? s.goal : 0;
    // the task asked no longer fits: another one
    if (phase.value === 'typing' && task.value && !pool.value.some((t) => t.key === task.value!.key)) pick();
    if (phase.value === 'empty' || phase.value === 'loading') pick();
  }

  // tense choice of the reference changed (shared with the trainer)
  function refresh(): void {
    if (phase.value === 'loading' || phase.value === 'empty') { pick(); return; }
    if (phase.value === 'typing' && task.value && !pool.value.some((t) => t.key === task.value!.key)) pick();
  }

  const leave = (): void => clearTimer();

  return { goals: GOALS, limits: LIMITS, only, task, typed, hinted, phase, outcome, previous, settings, day, pool, verb, forms, check, accentPending,
    start, input, hint, reveal, next, more, rest, carryOn, setSettings, refresh, leave };
});
