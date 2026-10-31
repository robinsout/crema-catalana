<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { useCatalogStore } from '../stores/catalog.ts';
import { useProgressStore } from '../stores/progress.ts';
import { useTrainerStore, type Task } from '../stores/trainer.ts';
import { useVerbsStore } from '../stores/verbs.ts';
import { useTocStore } from '../stores/toc.ts';
import { useI18n } from '../composables/useI18n.ts';
import { useTenseNames } from '../composables/useTenseNames.ts';
import AreaTabs from '../components/AreaTabs.vue';
import TenseSettings from '../components/TenseSettings.vue';
import TrainerSettings from '../components/TrainerSettings.vue';

const catalog = useCatalogStore();
const progress = useProgressStore();
const trainer = useTrainerStore();
const verbs = useVerbsStore();
const toc = useTocStore();
const { t } = useI18n();
const tenseName = useTenseNames();
const route = useRoute();

watch(() => catalog.lang, (lang) => { void verbs.load(lang); }, { immediate: true });
// the settings take the right column of wide screens
onMounted(() => toc.show([], 'trainer'));

const onlyVerb = (): string | null => (typeof route.query.verb === 'string' && route.query.verb ? route.query.verb : null);
watch(() => route.query.verb, () => trainer.start(onlyVerb()), { immediate: true });
watch(() => verbs.current.state, () => trainer.refresh());
watch(() => progress.verbTenses, () => trainer.refresh());
onBeforeUnmount(() => trainer.leave());

// "Present", "Present de subjuntiu", "Imperatiu"
const caTense = (id: string): string => {
  const x = verbs.tenses.find((y) => y.id === id);
  if (!x) return '';
  return x.mood === 'subj' ? `${x.ca} de subjuntiu` : x.ca;
};
const personName = (task: Task): string => (task.tense === 'imp' ? verbs.imperativePersons : verbs.persons)[task.person] ?? '';
// "fer|ind.pres|0" → "fer · jo · Present"
function label(key: string): { verb: string; text: string } {
  const [verb = '', tense = '', person = '0'] = key.split('|');
  const p = Number(person);
  return { verb, text: `${(tense === 'imp' ? verbs.imperativePersons : verbs.persons)[p] ?? ''} · ${caTense(tense)}` };
}

const input = ref<HTMLInputElement | null>(null);
const focused = ref(false);
const focusField = (): void => { void nextTick(() => input.value?.focus()); };
onMounted(() => { if (window.matchMedia?.('(min-width: 900px)').matches) focusField(); });

function onInput(e: Event): void {
  const el = e.target as HTMLInputElement;
  trainer.input(el.value);
  el.value = trainer.typed; // letters past a wrong one and past the form are dropped
}
function onKey(e: KeyboardEvent): void {
  if (e.key === 'Enter') { e.preventDefault(); trainer.next(); }
  else if (e.key === '?') { e.preventDefault(); trainer.hint(); }
}
// the field and the letters drawn under it
watch(() => trainer.typed, (v) => { if (input.value && input.value.value !== v) input.value.value = v; });

const letters = computed(() => [...trainer.typed].map((c, i) => ({
  c,
  cls: trainer.hinted.includes(i) ? 'l-almost l-hint' : `l-${trainer.check.letters[i] ?? 'ok'}`,
})));
const wrongNow = computed(() => trainer.phase === 'typing' && trainer.check.bad >= 0);
const fieldClass = computed(() => ({
  'is-focus': focused.value && trainer.phase === 'typing' && !wrongNow.value,
  'is-wrong': wrongNow.value || (trainer.phase === 'review' && trainer.outcome === 'missed'),
  'is-almost': trainer.phase === 'review' && trainer.outcome === 'almost',
  'is-correct': trainer.phase === 'pause',
}));

// after a mistake: the whole tense, singular | plural, the asked form marked
const row = computed(() => {
  const task = trainer.task;
  const v = trainer.verb;
  if (!task || !v || trainer.phase !== 'review' || trainer.outcome !== 'missed') return null;
  const rows = verbs.conjugate(v, task.tense);
  const at = (p: number) => rows.find((r) => r.person === p);
  const persons = task.tense === 'imp' ? verbs.imperativePersons : verbs.persons;
  const cells = [0, 3, 1, 4, 2, 5].map((p) => ({ p, name: persons[p] ?? '', form: at(p)?.forms[0] ?? '' })).filter((c) => c.name && c.form);
  return { title: `${v.id} · ${caTense(task.tense)}`, cells, asked: task.person };
});

const goal = computed(() => trainer.settings.goal);
const doneToday = computed(() => trainer.day.done);
const width = computed(() => `${Math.min(100, (doneToday.value / goal.value) * 100)}%`);
const actionOnly = (e: PointerEvent): void => e.preventDefault(); // the buttons keep the focus in the field

const verbLink = (id: string) => ({ name: 'verb', params: { lang: catalog.lang, verb: id } });
</script>

<template>
  <AreaTabs />
  <h2 class="visually-hidden">{{ t('trainer.title') }}</h2>
  <article class="lesson trainer trainer-page">
    <p v-if="verbs.current.state === 'error'" class="status">{{ t('verbs.loadError') }}</p>
    <p v-else-if="trainer.phase === 'loading'" class="status">{{ t('verbs.loading') }}</p>

    <div v-else-if="trainer.phase === 'summary'" class="tr-card tr-done" role="status">
      <h3>{{ t('trainer.goalDone') }}</h3>
      <p class="meta">{{ t('trainer.dayScore', { n: trainer.day.done, a: trainer.day.exact, b: trainer.day.almost, c: trainer.day.missed }) }}</p>
      <template v-if="trainer.day.review.length">
        <h4>{{ t('trainer.review') }}</h4>
        <ul class="tr-mistakes">
          <li v-for="(r, i) in trainer.day.review" :key="i">
            <RouterLink :to="verbLink(label(r.key).verb)" lang="ca">{{ label(r.key).verb }}</RouterLink> · <span lang="ca">{{ label(r.key).text }}</span> → <b lang="ca">{{ r.form }}</b>
            <span v-if="r.almost" class="muted"> · {{ t('trainer.almostShort') }}</span>
          </li>
        </ul>
      </template>
      <div class="head-actions">
        <button class="btn btn-solid tr-more" type="button" @click="trainer.more(); focusField()">{{ t('trainer.more') }}</button>
        <button class="btn tr-rest" type="button" @click="trainer.rest()">{{ t('trainer.rest') }}</button>
      </div>
    </div>

    <div v-else-if="trainer.phase === 'rest'" class="tr-card tr-done">
      <p class="tr-goal"><span>{{ t('trainer.restDone') }}</span></p>
      <button class="btn tr-carry" type="button" @click="trainer.carryOn(); focusField()">{{ t('trainer.carryOn') }}</button>
    </div>

    <div v-else-if="trainer.phase === 'empty'" class="tr-card">
      <p class="tr-count warn">{{ t('trainer.emptySet') }}</p>
    </div>

    <div v-else-if="trainer.task && trainer.verb" class="tr-card">
      <p class="tr-goal">
        <span>{{ t('trainer.today') }} <b>{{ doneToday }} / {{ goal }}</b></span>
        <span class="progress-bar" aria-hidden="true"><i :style="{ width }"></i></span>
      </p>
      <p class="tr-verb-line"><RouterLink class="tr-verb" :to="verbLink(trainer.verb.id)" lang="ca">{{ trainer.verb.id }}</RouterLink><span class="tr-gloss">{{ trainer.verb.tr }}</span></p>
      <p class="tr-ask"><span class="person" lang="ca">{{ personName(trainer.task) }}</span> · <span lang="ca">{{ caTense(trainer.task.tense) }}</span> <small>{{ tenseName(trainer.task.tense) }}</small></p>
      <div class="tr-field" :class="fieldClass" @click="focusField">
        <div class="tr-letters" lang="ca" aria-hidden="true">
          <span v-for="(l, i) in letters" :key="i" :class="l.cls">{{ l.c }}</span><span v-if="!trainer.typed" class="ph">{{ t('trainer.placeholder') }}</span>
        </div>
        <input ref="input" class="tr-input" lang="ca" type="text" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="next"
          :aria-label="t('trainer.fieldLabel', { verb: trainer.verb.id, person: personName(trainer.task), tense: caTense(trainer.task.tense) })"
          @input="onInput" @keydown="onKey" @focus="focused = true" @blur="focused = false">
        <button v-if="trainer.phase === 'pause'" class="tr-action tr-check" type="button" :aria-label="t('trainer.next')" @pointerdown="actionOnly" @click="trainer.next()">✓</button>
        <button v-else-if="trainer.phase === 'review' || trainer.accentPending" class="tr-action btn btn-solid tr-next" type="button" @pointerdown="actionOnly" @click="trainer.next(); focusField()">{{ t('trainer.nextKey') }}</button>
        <button v-else class="tr-action tr-hint" type="button" @pointerdown="actionOnly" @click="trainer.hint(); focusField()">{{ t('trainer.hint') }}<kbd>?</kbd></button>
      </div>
      <div class="tr-status" aria-live="polite">
        <span v-if="wrongNow" class="bad">{{ t('trainer.wrong') }}</span>
        <span v-else-if="trainer.accentPending">{{ t('trainer.accentPending') }}</span>
        <button v-if="trainer.phase === 'typing' && trainer.hinted.length" class="tr-reveal" type="button" @pointerdown="actionOnly" @click="trainer.reveal()">{{ t('trainer.reveal') }}</button>
        <span v-else-if="trainer.phase === 'pause'" class="ok">{{ t('trainer.right') }}</span>
        <span v-else-if="trainer.phase === 'review' && trainer.outcome === 'almost'"><b>{{ t('trainer.almost') }}</b> — {{ t('trainer.almostAccent') }} <b lang="ca">{{ trainer.check.target }}</b></span>
        <span v-else-if="trainer.phase === 'review'" class="bad">{{ t('trainer.hinted') }}</span>
      </div>
      <div v-if="row" class="tr-row">
        <p><span lang="ca">{{ row.title }}</span><RouterLink :to="verbLink(trainer.verb.id)">{{ t('trainer.allTenses') }}</RouterLink></p>
        <dl>
          <template v-for="c in row.cells" :key="c.p">
            <dt lang="ca">{{ c.name }}</dt>
            <dd lang="ca"><span :class="{ asked: c.p === row.asked }">{{ c.form }}</span></dd>
          </template>
        </dl>
      </div>
      <p v-else-if="trainer.previous" class="tr-prev">
        <span class="mark" :class="trainer.previous.outcome === 'exact' ? 'ok' : 'almost'" aria-hidden="true">{{ trainer.previous.outcome === 'exact' ? '✓' : '≈' }}</span>{{ t('trainer.previous') }}
        <RouterLink :to="verbLink(trainer.previous.task.verb)" lang="ca">{{ trainer.previous.task.verb }}</RouterLink> · <span lang="ca">{{ personName(trainer.previous.task) }} · {{ caTense(trainer.previous.task.tense) }}</span> → <b lang="ca">{{ trainer.previous.form }}</b>
      </p>
    </div>
    <p v-if="!['summary', 'rest'].includes(trainer.phase)" class="tr-keys"><kbd>Enter</kbd> {{ t('trainer.keyNext') }} · <kbd>?</kbd> {{ t('trainer.keyHint') }} · {{ t('trainer.keyAccents') }}</p>

    <details class="tr-set">
      <summary>{{ t('trainer.set') }}</summary>
      <div class="tr-set-body"><TrainerSettings tag="p" /></div>
    </details>
    <TenseSettings />
  </article>
</template>
