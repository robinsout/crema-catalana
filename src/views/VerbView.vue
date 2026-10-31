<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { useCatalogStore } from '../stores/catalog.ts';
import { useProgressStore } from '../stores/progress.ts';
import { useVerbsStore } from '../stores/verbs.ts';
import { useTocStore } from '../stores/toc.ts';
import { useI18n } from '../composables/useI18n.ts';
import { useTenseNames } from '../composables/useTenseNames.ts';
import type { Mood } from '../types/index.ts';
import AreaTabs from '../components/AreaTabs.vue';
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

// the tenses shown, by mood: the right column, the chapters panel and the phone menu jump to them
const toc = useTocStore();
watch([moods, () => shown.value.has('nonpers'), verb], () => {
  const list = moods.value.flatMap((m) => m.tenses.map((x) => ({ id: `t-${x.id}`, title: x.mood === 'imp' ? m.name : x.ca, group: m.name })));
  if (verb.value && shown.value.has('nonpers')) list.push({ id: 't-nonpers', title: MOODS.nonpers, group: MOODS.nonpers });
  toc.show(list, 'verb');
}, { immediate: true, flush: 'post' });
onBeforeUnmount(() => { verbs.settingsOpen = false; });
// the menu of the verbs area lists the verbs opened last
watch(verb, (v) => { if (v) progress.addRecentVerb(v.id); }, { immediate: true });
</script>

<template>
  <AreaTabs />
  <p v-if="verbs.current.state === 'loading'" class="status">{{ t('verbs.loading') }}</p>
  <p v-else-if="verbs.current.state === 'error'" class="status">{{ t('verbs.loadError') }}</p>
  <template v-else-if="!verb">
    <p class="status">{{ t('verbs.notFound') }}</p>
    <RouterLink class="btn" :to="{ name: 'verbs', params: { lang: catalog.lang } }">{{ t('verbs.back') }}</RouterLink>
  </template>
  <template v-else>
    <header class="lesson-head verb-head">
      <p class="eyebrow"><RouterLink :to="{ name: 'verbs', params: { lang: catalog.lang } }">{{ t('verbs.back') }}</RouterLink>
        · <RouterLink class="verb-practice" :to="{ name: 'trainer', params: { lang: catalog.lang }, query: { verb: verb.id } }">{{ t('trainer.practise') }}</RouterLink></p>
      <h2 lang="ca">{{ verb.id }}</h2>
      <p class="sub">{{ verb.tr }} <span class="meta">· {{ t('verbs.rank', { rank: verb.rank }) }}<template v-if="model"> · {{ t('verbs.model') }}
        <RouterLink v-if="model.listed" :to="{ name: 'verb', params: { lang: catalog.lang, verb: model.name } }" lang="ca">{{ model.name }}</RouterLink>
        <span v-else lang="ca">{{ model.name }}</span></template></span></p>
    </header>
    <article class="lesson verb">
      <TenseSettings />
      <p v-if="!shown.size" class="status">{{ t('verbs.noTenses') }}</p>
      <section v-for="m in moods" :key="m.mood" class="mood">
        <h3 lang="ca">{{ m.name }}</h3>
        <div class="conj-grid">
          <div v-for="x in m.tenses" :id="`t-${x.id}`" :key="x.id" class="conj-card" :data-tense="x.id">
            <h4><span lang="ca">{{ x.mood === 'imp' ? 'Afirmatiu' : x.ca }}</span> <small>{{ tenseName(x.id) }}</small></h4>
            <table class="conj">
              <tbody>
                <tr v-for="r in x.rows" :key="r.person">
                  <th lang="ca">{{ persons(m.mood)[r.person] }}</th>
                  <td lang="ca"><template v-if="r.forms.length"><span class="form">{{ r.forms[0] }}</span><span v-for="f in r.forms.slice(1)" :key="f" class="alt"> / <span class="form">{{ f }}</span></span></template><template v-else>—</template></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
      <section v-if="shown.has('nonpers')" id="t-nonpers" class="mood">
        <h3 lang="ca">{{ MOODS.nonpers }}</h3>
        <table class="conj nonpers">
          <tbody>
            <tr v-for="r in nonPersonal(verb)" :key="r.id">
              <th lang="ca">{{ r.ca }}</th>
              <td lang="ca"><span class="form">{{ r.forms[0] }}</span><span v-for="f in r.forms.slice(1)" :key="f" class="alt"> / <span class="form">{{ f }}</span></span></td>
            </tr>
          </tbody>
        </table>
      </section>
      <p class="meta verb-source">{{ t('verbs.source') }}</p>
    </article>
  </template>
</template>
