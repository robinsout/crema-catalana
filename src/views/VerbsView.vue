<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useCatalogStore } from '../stores/catalog.ts';
import { useVerbsStore } from '../stores/verbs.ts';
import { useTocStore } from '../stores/toc.ts';
import { useI18n } from '../composables/useI18n.ts';
import { useTenseNames } from '../composables/useTenseNames.ts';
import TenseSettings from '../components/TenseSettings.vue';

const catalog = useCatalogStore();
const verbs = useVerbsStore();
const { t } = useI18n();
const tenseName = useTenseNames();
const route = useRoute();
const router = useRouter();

watch(() => catalog.lang, (lang) => { void verbs.load(lang); }, { immediate: true });

// the query stays in the address (?q=), so coming back from a verb keeps the search
const query = ref(typeof route.query.q === 'string' ? route.query.q : '');
watch(query, (q) => { void router.replace({ query: q ? { q } : {} }); });

const index = computed(() => (verbs.list.state === 'ready' ? verbs.list.index : null));
// the list is there, the forms are not yet: a search by a form may still find something
const formsLoading = computed(() => verbs.current.state === 'loading');
const hits = computed(() => (index.value ? verbs.search(query.value) : []));
// a search page: no sections on the right
const toc = useTocStore();
onMounted(() => toc.show([], 'plan'));
const caName = (id: string): string => verbs.tenses.find((x) => x.id === id)?.ca ?? '';
</script>

<template>
  <header class="lesson-head">
    <p class="eyebrow">{{ t('nav.verbs') }}</p>
    <h2>{{ t('verbs.title') }}</h2>
    <p class="sub">{{ t('verbs.sub', { count: index?.verbs.length ?? '' }) }}</p>
  </header>
  <article class="lesson verbs">
    <label class="verb-search">
      <span class="visually-hidden">{{ t('verbs.searchLabel') }}</span>
      <input v-model="query" type="search" :placeholder="t('verbs.search')" :aria-label="t('verbs.searchLabel')" autocomplete="off" autocapitalize="off" spellcheck="false">
    </label>
    <TenseSettings />
    <p v-if="verbs.list.state === 'loading'" class="status">{{ t('verbs.loading') }}</p>
    <p v-else-if="verbs.list.state === 'error'" class="status">{{ t('verbs.loadError') }}</p>
    <template v-else>
      <p v-if="!hits.length" class="status">{{ formsLoading ? t('verbs.loading') : t('verbs.none') }}</p>
      <ol class="verb-list">
        <li v-for="h in hits" :key="h.verb.id">
          <RouterLink :to="{ name: 'verb', params: { lang: catalog.lang, verb: h.verb.id } }">
            <span class="verb-inf" lang="ca">{{ h.verb.id }}</span>
            <span class="verb-tr">{{ h.verb.tr }}</span>
            <span v-if="h.form" class="verb-form"><span lang="ca">{{ h.form }}</span> · <span lang="ca">{{ caName(h.tense ?? '') }}</span><template v-if="h.tense"> ({{ tenseName(h.tense) }})</template></span>
          </RouterLink>
        </li>
      </ol>
    </template>
    <p class="meta verb-source">{{ t('verbs.source') }}</p>
  </article>
</template>
