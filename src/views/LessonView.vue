<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { useCatalogStore } from '../stores/catalog.ts';
import { useLessonsStore } from '../stores/lessons.ts';
import { useProgressStore } from '../stores/progress.ts';
import { useTocStore } from '../stores/toc.ts';
import { useAudioStore } from '../stores/audio.ts';
import { useI18n } from '../composables/useI18n.ts';
import { useLessonLink } from '../composables/useLessonLink.ts';
import VocabSection from '../components/VocabSection.vue';
import FillExercise from '../components/FillExercise.vue';
import ChoiceExercise from '../components/ChoiceExercise.vue';

const catalog = useCatalogStore();
const lessons = useLessonsStore();
const progress = useProgressStore();
const toc = useTocStore();
const audio = useAudioStore();
const { t, formatDate } = useI18n();
const linkTo = useLessonLink();
const route = useRoute();

const lesson = computed(() => catalog.find(String(route.params.id ?? '')));
const content = computed(() => (lesson.value ? lessons.content(lesson.value) : { state: 'error' as const }));
const root = ref<HTMLElement | null>(null);
const vocab = computed(() => (lesson.value ? lessons.vocab(lesson.value) : null));
const exercises = computed(() => Object.entries(lesson.value ? lessons.exercises(lesson.value) : {}));

const pager = computed(() => (lesson.value ? catalog.neighboursOf(lesson.value.id) : { prev: null, next: null }));
const related = computed(() =>
  lesson.value?.track === 'unit' ? catalog.relatedTo(lesson.value.id).filter((x) => x.file) : []);
const done = computed(() => (lesson.value ? progress.isDone(lesson.value.id) : false));
const plan = computed(() => ({ name: 'plan', params: { lang: catalog.lang } }));

watch(lesson, (l) => { if (l?.file) lessons.load(l, catalog.lang); }, { immediate: true });
// a lesson not yet written in this language: the languages it can be read in (found by the router)
const writtenIn = computed(() => (lesson.value && !lesson.value.file ? catalog.writtenIn[lesson.value.id] ?? [] : []));
const inLanguage = (code: string) => ({ name: 'lesson', params: { lang: code, id: lesson.value?.id ?? '' } });

// Chapters of the rendered lesson: the table of contents, and a placeholder at the end of each
// chapter for its "studied" button.
const chapters = ref<string[]>([]);
watch(() => content.value.state, async (state) => {
  // the same lesson loading in another language keeps its chapters (same ids in every language)
  // until the new text is there: the menu and the contents do not collapse and jump meanwhile
  if (state === 'loading' && toc.lesson === lesson.value?.id) return;
  chapters.value = [];
  await nextTick();
  const ready = state === 'ready' && root.value !== null;
  toc.collect(ready ? root.value : null, 'lesson', lesson.value?.id ?? null);
  if (!ready) return;
  const found = [...root.value!.querySelectorAll<HTMLElement>('article.lesson > section[id]')];
  for (const s of found) {
    if (s.querySelector(':scope > .section-end')) continue;
    const end = document.createElement('div');
    end.className = 'section-end';
    end.dataset.sectionEnd = s.id;
    s.append(end);
  }
  chapters.value = found.map((s) => s.id);
}, { immediate: true });

// A chapter on screen for a few seconds counts as read (scrolling past it does not).
const READ_AFTER_MS = 3000;
let reading: ReturnType<typeof setTimeout> | undefined;
watch(() => toc.active, (id) => {
  clearTimeout(reading);
  const l = lesson.value;
  if (!id || !l || toc.lesson !== l.id) return;
  reading = setTimeout(() => progress.reachSection(l.id, id, toc.ids), READ_AFTER_MS);
});
onBeforeUnmount(() => clearTimeout(reading));

// where the reader stopped last time, unless it is the start or the lesson is finished
const resumeAt = computed(() => {
  const l = lesson.value;
  if (!l || done.value || toc.lesson !== l.id) return null;
  const id = progress.readingPoint(l.id);
  return id && toc.ids.indexOf(id) > 0 ? { id, title: toc.titleOf(id) } : null;
});
</script>

<template>
  <template v-if="lesson && !lesson.file">
    <header class="lesson-head">
      <p class="eyebrow">{{ catalog.label(lesson) }}</p>
      <h2 lang="ca">{{ lesson.title }}</h2>
    </header>
    <p class="lesson-missing">
      {{ t('lesson.missing') }}
      <template v-for="(code, i) in writtenIn" :key="code">{{ i ? ', ' : ' ' }}<RouterLink :to="inLanguage(code)" :lang="code">{{ catalog.languageName(code) }}</RouterLink></template>
    </p>
    <nav class="pager" :aria-label="t('pager.label')"><RouterLink :to="plan">{{ t('pager.planNext') }}</RouterLink></nav>
  </template>
  <template v-else-if="lesson">
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
        <p v-if="audio.available" class="say-tip">{{ t('say.tip') }}</p>
        <p v-if="resumeAt" class="resume">
          <span>{{ t('resume.text', { title: resumeAt.title }) }}</span>
          <button class="btn" type="button" @click="toc.jump(resumeAt.id)">{{ t('resume.go') }}</button>
        </p>
      </header>
      <div ref="root">
        <article class="lesson" v-html="content.html"></article>
        <!-- interactive exercises are mounted into their placeholders inside the lesson HTML -->
        <Teleport v-for="[id, ex] in exercises" :key="`${lesson.id}/${id}`" :to="`[data-exercise='${id}']`" defer>
          <FillExercise v-if="ex.type === 'fill'" :id="`${lesson.id}/${id}`" :items="ex.items" />
          <ChoiceExercise v-else :id="`${lesson.id}/${id}`" :items="ex.items" />
        </Teleport>
        <Teleport v-for="id in chapters" :key="`${lesson.id}#${id}`" :to="`[data-section-end='${id}']`" defer>
          <button class="btn section-btn" :class="{ 'is-done': progress.isSectionDone(lesson.id, id) }" type="button"
            :aria-pressed="progress.isSectionDone(lesson.id, id)" @click="progress.toggleSection(lesson.id, id)">
            {{ progress.isSectionDone(lesson.id, id) ? t('section.studied') : t('section.markStudied') }}
          </button>
        </Teleport>
        <div v-if="vocab?.length" class="lesson">
          <VocabSection :groups="vocab" />
        </div>
      </div>
      <div class="lesson-end">
        <button class="btn" :class="{ 'is-done': done }" type="button" @click="progress.toggleDone(lesson.id)">
          {{ done ? t('lesson.isDone') : t('lesson.markDone') }}
        </button>
      </div>
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
