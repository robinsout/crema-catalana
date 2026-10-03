<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { useCatalogStore } from '../stores/catalog.ts';
import { useLessonsStore } from '../stores/lessons.ts';
import { useProgressStore } from '../stores/progress.ts';
import { useTocStore } from '../stores/toc.ts';
import { useI18n } from '../composables/useI18n.ts';
import { useLessonLink } from '../composables/useLessonLink.ts';

const catalog = useCatalogStore();
const lessons = useLessonsStore();
const progress = useProgressStore();
const toc = useTocStore();
const { t, formatDate } = useI18n();
const linkTo = useLessonLink();
const route = useRoute();

const lesson = computed(() => catalog.find(String(route.params.id ?? '')));
const content = computed(() => (lesson.value ? lessons.content(lesson.value) : { state: 'error' as const }));
const article = ref<HTMLElement | null>(null);

const pager = computed(() => (lesson.value ? catalog.neighboursOf(lesson.value.id) : { prev: null, next: null }));
const related = computed(() =>
  lesson.value?.track === 'unit' ? catalog.relatedTo(lesson.value.id).filter((x) => x.file) : []);
const done = computed(() => (lesson.value ? progress.isDone(lesson.value.id) : false));
const plan = computed(() => ({ name: 'plan', params: { lang: catalog.lang } }));

watch(lesson, (l) => { if (l) lessons.load(l); }, { immediate: true });

// the table of contents follows the rendered lesson
watch(() => content.value.state, async (state) => {
  await nextTick();
  toc.collect(state === 'ready' ? article.value : null, 'lesson');
}, { immediate: true });
</script>

<template>
  <template v-if="lesson">
    <p v-if="content.state === 'loading'" class="status">{{ t('status.loading') }}</p>
    <p v-else-if="content.state === 'error'" class="status">{{ t('status.lessonError', { title: lesson.title }) }}</p>
    <template v-else>
      <header class="lesson-head">
        <p class="eyebrow">{{ catalog.label(lesson) }}</p>
        <h2 lang="ca">{{ lesson.title }}</h2>
        <p class="sub">{{ lesson.subtitle || lesson.topic || '' }}</p>
        <div class="head-actions">
          <button class="btn" :class="{ 'is-done': done }" type="button" @click="progress.toggleDone(lesson.id)">
            {{ done ? t('lesson.isDone') : t('lesson.markDone') }}
          </button>
          <span v-if="lesson.date" class="meta">{{ formatDate(lesson.date) }}</span>
        </div>
      </header>
      <article ref="article" class="lesson" v-html="content.html"></article>
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
