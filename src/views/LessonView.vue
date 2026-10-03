<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { useCatalogStore } from '../stores/catalog.ts';
import { useProgressStore } from '../stores/progress.ts';
import { useTocStore } from '../stores/toc.ts';
import { useI18n } from '../composables/useI18n.ts';
import { useLessonLink } from '../composables/useLessonLink.ts';
import { lessonLabel, neighbours, relatedExtras } from '../lib/model.ts';

const catalog = useCatalogStore();
const progress = useProgressStore();
const toc = useTocStore();
const { t, formatDate } = useI18n();
const linkTo = useLessonLink();
const route = useRoute();

const lesson = computed(() => catalog.find(String(route.params.id ?? '')));
const body = ref('');
const state = ref<'loading' | 'ready' | 'error'>('loading');
const article = ref<HTMLElement | null>(null);

const pager = computed(() => (lesson.value ? neighbours(catalog.catalog, lesson.value.id) : { prev: null, next: null }));
const related = computed(() =>
  lesson.value?.track === 'unit' ? relatedExtras(catalog.catalog, lesson.value.id).filter((x) => x.file) : []);
const done = computed(() => (lesson.value ? progress.isDone(lesson.value.id) : false));
const plan = computed(() => ({ name: 'plan', params: { lang: catalog.lang } }));

watch(() => lesson.value?.file, async (file) => {
  state.value = 'loading';
  toc.collect(null, 'lesson');
  if (!file) { state.value = 'error'; return; }
  try {
    const res = await fetch(file);
    if (!res.ok) throw new Error(String(res.status));
    const html = await res.text();
    if (file !== lesson.value?.file) return; // another lesson was opened meanwhile
    body.value = html;
    state.value = 'ready';
    await nextTick();
    toc.collect(article.value, 'lesson');
  } catch {
    state.value = 'error';
  }
}, { immediate: true });
</script>

<template>
  <template v-if="lesson">
    <p v-if="state === 'loading'" class="status">{{ t('status.loading') }}</p>
    <p v-else-if="state === 'error'" class="status">{{ t('status.lessonError', { title: lesson.title }) }}</p>
    <template v-else>
      <header class="lesson-head">
        <p class="eyebrow">{{ lessonLabel(lesson, t) }}</p>
        <h2 lang="ca">{{ lesson.title }}</h2>
        <p class="sub">{{ lesson.subtitle || lesson.topic || '' }}</p>
        <div class="head-actions">
          <button class="btn" :class="{ 'is-done': done }" type="button" @click="progress.toggleDone(lesson.id)">
            {{ done ? t('lesson.isDone') : t('lesson.markDone') }}
          </button>
          <span v-if="lesson.date" class="meta">{{ formatDate(lesson.date) }}</span>
        </div>
      </header>
      <article ref="article" class="lesson" v-html="body"></article>
      <p v-if="related.length" class="related">
        {{ t('lesson.related') }}
        <template v-for="(x, i) in related" :key="x.id">{{ i ? ', ' : '' }}<RouterLink :to="linkTo(x)" lang="ca">{{ x.title }}</RouterLink></template>
      </p>
      <nav class="pager" :aria-label="t('pager.label')">
        <RouterLink v-if="pager.prev" :to="linkTo(pager.prev)">← {{ pager.prev.title }}</RouterLink>
        <RouterLink v-else :to="plan">{{ t('pager.planPrev') }}</RouterLink>
        <RouterLink v-if="pager.next" :to="linkTo(pager.next)">{{ pager.next.title }} →</RouterLink>
        <RouterLink v-else :to="plan">{{ t('pager.planNext') }}</RouterLink>
      </nav>
    </template>
  </template>
</template>
