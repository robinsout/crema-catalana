<script setup lang="ts">
import { computed, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { useCatalogStore } from '../stores/catalog.ts';
import { useProgressStore } from '../stores/progress.ts';
import { useVerbsStore } from '../stores/verbs.ts';
import { useI18n } from '../composables/useI18n.ts';
import { useTenseNames } from '../composables/useTenseNames.ts';
import type { Mood } from '../types/index.ts';
import TenseSettings from '../components/TenseSettings.vue';

const catalog = useCatalogStore();
const progress = useProgressStore();
const verbs = useVerbsStore();
const { t } = useI18n();
const tenseName = useTenseNames();
const route = useRoute();
const { conjugate, nonPersonal, tenses: TENSES, moods: MOODS, persons: PERSONS, imperativePersons: IMPERATIVE_PERSONS } = verbs;

watch(() => catalog.lang, (lang) => { void verbs.load(lang); }, { immediate: true });

const verb = computed(() => (verbs.current.state === 'ready' ? verbs.find(String(route.params.verb ?? '')) : null));
const model = computed(() => {
  const m = verb.value?.model;
  if (!m || m === verb.value?.inf) return null;
  return { name: m, listed: !!verbs.find(m) };
});

const shown = computed(() => new Set(progress.verbTenses));
const moods = computed(() => {
  const v = verb.value;
  if (!v) return [];
  return (Object.keys(MOODS) as Mood[]).filter((m) => m !== 'nonpers').map((mood) => ({
    mood,
    name: MOODS[mood],
    tenses: TENSES.filter((x) => x.mood === mood && x.id !== 'nonpers' && shown.value.has(x.id))
      .map((x) => ({ ...x, rows: conjugate(v, x.id as Exclude<typeof x.id, 'nonpers'>) })),
  })).filter((m) => m.tenses.length);
});
const persons = (mood: Mood): string[] => (mood === 'imp' ? IMPERATIVE_PERSONS : PERSONS);
</script>

<template>
  <p v-if="verbs.current.state === 'loading'" class="status">{{ t('verbs.loading') }}</p>
  <p v-else-if="verbs.current.state === 'error'" class="status">{{ t('verbs.loadError') }}</p>
  <template v-else-if="!verb">
    <p class="status">{{ t('verbs.notFound') }}</p>
    <RouterLink class="btn" :to="{ name: 'verbs', params: { lang: catalog.lang } }">{{ t('verbs.back') }}</RouterLink>
  </template>
  <template v-else>
    <header class="lesson-head">
      <p class="eyebrow"><RouterLink :to="{ name: 'verbs', params: { lang: catalog.lang } }">{{ t('verbs.back') }}</RouterLink></p>
      <h2 lang="ca">{{ verb.id }}</h2>
      <p class="sub">{{ verb.tr }}</p>
      <p class="meta">
        {{ t('verbs.rank', { rank: verb.rank }) }}
        <template v-if="model"> · {{ t('verbs.model') }}
          <RouterLink v-if="model.listed" :to="{ name: 'verb', params: { lang: catalog.lang, verb: model.name } }" lang="ca">{{ model.name }}</RouterLink>
          <span v-else lang="ca">{{ model.name }}</span>
        </template>
      </p>
    </header>
    <article class="lesson verb">
      <TenseSettings />
      <p v-if="!shown.size" class="status">{{ t('verbs.noTenses') }}</p>
      <section v-for="m in moods" :key="m.mood" class="mood">
        <h3 lang="ca">{{ m.name }}</h3>
        <div class="conj-grid">
          <div v-for="x in m.tenses" :key="x.id" class="conj-card" :data-tense="x.id">
            <h4><span lang="ca">{{ x.mood === 'imp' ? 'Afirmatiu' : x.ca }}</span> <small>{{ tenseName(x.id) }}</small></h4>
            <table class="conj">
              <tbody>
                <tr v-for="r in x.rows" :key="r.person">
                  <th lang="ca">{{ persons(m.mood)[r.person] }}</th>
                  <td lang="ca"><template v-if="r.forms.length">{{ r.forms[0] }}<span v-for="f in r.forms.slice(1)" :key="f" class="alt"> / {{ f }}</span></template><template v-else>—</template></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
      <section v-if="shown.has('nonpers')" class="mood">
        <h3 lang="ca">{{ MOODS.nonpers }}</h3>
        <table class="conj nonpers">
          <tbody>
            <tr v-for="r in nonPersonal(verb)" :key="r.id">
              <th lang="ca">{{ r.ca }}</th>
              <td lang="ca">{{ r.forms[0] }}<span v-for="f in r.forms.slice(1)" :key="f" class="alt"> / {{ f }}</span></td>
            </tr>
          </tbody>
        </table>
      </section>
      <p class="meta verb-source">{{ t('verbs.source') }}</p>
    </article>
  </template>
</template>
