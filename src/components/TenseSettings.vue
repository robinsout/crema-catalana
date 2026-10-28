<script setup lang="ts">
import { computed } from 'vue';
import type { Mood, TenseId } from '../types/index.ts';
import { useProgressStore } from '../stores/progress.ts';
import { useVerbsStore } from '../stores/verbs.ts';
import { useI18n } from '../composables/useI18n.ts';
import { useTenseNames } from '../composables/useTenseNames.ts';

const progress = useProgressStore();
const verbs = useVerbsStore();
const { tenses: TENSES, moods: MOODS, defaultTenses: DEFAULT_TENSES } = verbs;
const { t } = useI18n();
const tenseName = useTenseNames();

const on = computed(() => new Set(progress.verbTenses));
const groups = computed(() => (Object.keys(MOODS) as Mood[]).map((mood) => ({ mood, name: MOODS[mood], tenses: TENSES.filter((x) => x.mood === mood) })));
// kept in the order of TENSES
const set = (ids: Iterable<TenseId>): void => { const s = new Set(ids); progress.setVerbTenses(TENSES.map((x) => x.id).filter((id) => s.has(id))); };
function toggle(id: TenseId): void {
  const next = new Set(on.value);
  if (next.has(id)) next.delete(id); else next.add(id);
  set(next);
}
</script>

<template>
  <details id="tense-settings" class="tense-settings" :open="verbs.settingsOpen" @toggle="verbs.settingsOpen = ($event.target as HTMLDetailsElement).open">
    <summary>{{ t('verbs.tenses', { on: on.size, total: TENSES.length }) }}</summary>
    <p class="meta">{{ t('verbs.tensesHint') }}</p>
    <div class="head-actions">
      <button class="btn tenses-all" type="button" @click="set(TENSES.map((x) => x.id))">{{ t('verbs.tensesAll') }}</button>
      <button class="btn tenses-default" type="button" @click="set(DEFAULT_TENSES)">{{ t('verbs.tensesDefault') }}</button>
    </div>
    <fieldset v-for="g in groups" :key="g.mood">
      <legend lang="ca">{{ g.name }}</legend>
      <label v-for="x in g.tenses" :key="x.id">
        <input type="checkbox" :checked="on.has(x.id)" :data-tense="x.id" @change="toggle(x.id)">
        <span><span lang="ca">{{ x.ca }}</span><small>{{ tenseName(x.id) }}</small></span>
      </label>
    </fieldset>
  </details>
</template>
