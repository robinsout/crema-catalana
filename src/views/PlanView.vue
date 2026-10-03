<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useCatalogStore } from '../stores/catalog.ts';
import { useTocStore } from '../stores/toc.ts';
import { useI18n } from '../composables/useI18n.ts';
import { allLessons } from '../lib/model.ts';
import type { Lesson } from '../lib/types.ts';
import UnitRow from '../components/UnitRow.vue';
import ExtraRow from '../components/ExtraRow.vue';

const catalog = useCatalogStore();
const toc = useTocStore();
const { t } = useI18n();
const route = useRoute();
const article = ref<HTMLElement | null>(null);

const course = computed(() => catalog.catalog.course);
const extras = computed(() => allLessons(catalog.catalog).filter((l) => l.track === 'extra'));
const focus = computed(() => (typeof route.params.focus === 'string' ? route.params.focus : ''));
const unitsOf = (partId: string): Lesson[] =>
  allLessons(catalog.catalog).filter((l) => l.track === 'unit' && l.part.id === partId);

const jump = (id: string): void => document.getElementById(id)?.scrollIntoView();

// A focused unit (link to a lesson that is not written yet) is scrolled into view and held at the
// top while the page settles (web fonts swap in and change the height of the text above it).
// The hold ends after a few seconds or as soon as the reader scrolls.
let release: (() => void) | null = null;

async function scrollToFocus(): Promise<void> {
  release?.();
  await nextTick();
  const el = focus.value ? document.getElementById(`u-${focus.value}`) : null;
  if (!el || !article.value) return;
  el.scrollIntoView({ block: 'start' });
  if (typeof ResizeObserver === 'undefined') return;
  const keep = new ResizeObserver(() => el.scrollIntoView({ block: 'start' }));
  keep.observe(article.value);
  const stop = () => {
    keep.disconnect();
    clearTimeout(timer);
    for (const e of ['wheel', 'touchstart', 'keydown'] as const) window.removeEventListener(e, stop);
    release = null;
  };
  const timer = setTimeout(stop, 3000);
  for (const e of ['wheel', 'touchstart', 'keydown'] as const) window.addEventListener(e, stop, { passive: true });
  release = stop;
}

onMounted(() => {
  toc.collect(article.value, 'plan');
  scrollToFocus();
});
watch(focus, scrollToFocus);
onBeforeUnmount(() => release?.());
</script>

<template>
  <header class="lesson-head">
    <p class="eyebrow">{{ t('plan.eyebrow') }}</p>
    <h2 lang="ca">{{ course.title }}<template v-if="course.level"> · {{ course.level }}</template></h2>
    <p class="sub">{{ t('plan.sub', { course: course.title ?? '', publisher: course.publisher ?? '' }) }}</p>
  </header>
  <article ref="article" class="lesson plan">
    <p v-html="t('plan.intro')"></p>
    <p class="meta">{{ t('plan.note') }}</p>
    <ol class="parts">
      <li v-if="extras.length">
        <a href="#" @click.prevent="jump('extras')">
          <span class="parts-t">{{ t('plan.extrasCard') }}</span><span class="parts-p">{{ t('plan.onRequest') }}</span><span class="parts-f">{{ t('plan.extrasCount', { n: extras.length }) }}</span>
        </a>
      </li>
      <li v-for="p in catalog.catalog.parts" :key="p.id">
        <a href="#" @click.prevent="jump(p.id)">
          <span class="parts-t" lang="ca">{{ p.title }}</span><span class="parts-p">{{ p.period }}</span><span class="parts-f">{{ p.focus }}</span>
        </a>
      </li>
    </ol>
    <section v-if="extras.length" id="extras">
      <h2><span>{{ t('plan.extrasTitle') }}</span> <span class="h-period">{{ t('plan.onRequest') }}</span></h2>
      <p>{{ t('plan.extrasLead') }}</p>
      <ExtraRow v-for="x in extras" :key="x.id" :lesson="x" :focused="x.id === focus" />
    </section>
    <section v-for="p in catalog.catalog.parts" :id="p.id" :key="p.id">
      <h2><span lang="ca">{{ p.title }}</span> <span class="h-period">{{ p.period }}</span></h2>
      <p>{{ p.focus }}.</p>
      <UnitRow v-for="u in unitsOf(p.id)" :key="u.id" :lesson="u" :focused="u.id === focus" />
    </section>
  </article>
</template>
