<script setup lang="ts">
import { computed } from 'vue';
import { useProgressStore } from '../stores/progress.ts';
import { useTrainerStore, type Goal, type Limit } from '../stores/trainer.ts';
import { useVerbsStore } from '../stores/verbs.ts';
import { useTocStore } from '../stores/toc.ts';
import { useI18n } from '../composables/useI18n.ts';

// The set of tasks: tenses (shared with the reference), persons, how many verbs, which kinds, the goal.
// Shown in the right column on wide screens and folded under the card on narrower ones (`tag`).
defineProps<{ tag?: 'div' | 'p' }>();
const trainer = useTrainerStore();
const progress = useProgressStore();
const verbs = useVerbsStore();
const toc = useTocStore();
const { t } = useI18n();

const s = computed(() => trainer.settings);
// singular | plural, as in the tables
const PERSON_ORDER = [0, 3, 1, 4, 2, 5];
const tenseNames = computed(() => verbs.tenses.filter((x) => x.id !== 'nonpers' && progress.verbTenses.includes(x.id))
  .map((x) => (x.mood === 'subj' ? `${x.ca} de subjuntiu` : x.ca)).join(', '));
const tensesOn = computed(() => progress.verbTenses.filter((id) => id !== 'nonpers').length);
const total = computed(() => verbs.current.state === 'ready' ? verbs.current.index.verbs.length : 0);

function person(i: number, on: boolean): void {
  const persons = s.value.persons.map((p, j) => (j === i ? on : p));
  if (persons.some(Boolean)) trainer.setSettings({ persons });
}
function kind(k: 'regular' | 'irregular', on: boolean): void {
  const kinds = { ...s.value.kinds, [k]: on };
  if (kinds.regular || kinds.irregular) trainer.setSettings({ kinds });
}
const limit = (l: Limit): void => trainer.setSettings({ limit: l });
const goal = (g: Goal): void => trainer.setSettings({ goal: g });
const openTenses = (): void => { verbs.settingsOpen = true; toc.jump('tense-settings'); };
</script>

<template>
  <div class="tr-settings">
    <fieldset>
      <legend>{{ t('trainer.tenses') }} <span class="meta">{{ t('trainer.tensesOn', { on: tensesOn, total: verbs.tenses.length - 1 }) }}</span></legend>
      <p class="tr-tenses"><span lang="ca">{{ tenseNames || '—' }}</span> · <a href="#tense-settings" @click.prevent="openTenses">{{ t('trainer.change') }}</a></p>
    </fieldset>
    <fieldset>
      <legend>{{ t('trainer.persons') }}</legend>
      <div class="tr-persons">
        <label v-for="i in PERSON_ORDER" :key="i">
          <input type="checkbox" :data-person="i" :checked="s.persons[i]" :disabled="s.persons[i] && s.persons.filter(Boolean).length === 1"
            @change="person(i, ($event.target as HTMLInputElement).checked)">
          <span lang="ca">{{ verbs.persons[i] }}</span>
        </label>
      </div>
    </fieldset>
    <fieldset>
      <legend>{{ t('trainer.limit') }}</legend>
      <div class="pills small">
        <label v-for="l in trainer.limits" :key="l">
          <input type="radio" :name="`tr-limit-${tag ?? 'side'}`" :data-limit="l" :checked="s.limit === l" @change="limit(l)">{{ l ? l : t('trainer.all', { n: total }) }}
        </label>
      </div>
    </fieldset>
    <fieldset>
      <legend>{{ t('trainer.kinds') }}</legend>
      <div class="tr-persons one">
        <label><input type="checkbox" data-kind="regular" :checked="s.kinds.regular" :disabled="s.kinds.regular && !s.kinds.irregular" @change="kind('regular', ($event.target as HTMLInputElement).checked)">{{ t('trainer.regular') }}</label>
        <label><input type="checkbox" data-kind="irregular" :checked="s.kinds.irregular" :disabled="s.kinds.irregular && !s.kinds.regular" @change="kind('irregular', ($event.target as HTMLInputElement).checked)">{{ t('trainer.irregular') }}</label>
      </div>
    </fieldset>
    <fieldset>
      <legend>{{ t('trainer.goal') }}</legend>
      <div class="pills small">
        <label v-for="g in trainer.goals" :key="g">
          <input type="radio" :name="`tr-goal-${tag ?? 'side'}`" :data-goal="g" :checked="s.goal === g" @change="goal(g)">{{ g }}
        </label>
      </div>
    </fieldset>
    <p class="tr-count" :class="{ warn: !trainer.pool.length }">{{ trainer.pool.length ? t('trainer.count', { n: trainer.pool.length }) : t('trainer.emptySet') }}</p>
  </div>
</template>
