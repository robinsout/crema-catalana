<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { useCatalogStore } from '../stores/catalog.ts';
import { useProgressStore } from '../stores/progress.ts';
import { useTocStore } from '../stores/toc.ts';
import { useI18n } from '../composables/useI18n.ts';
import { useLessonLink } from '../composables/useLessonLink.ts';
import type { Lesson } from '../types/index.ts';
import LessonBadge from './LessonBadge.vue';
import SyncStatusLine from './SyncStatusLine.vue';
import TableOfContents from './TableOfContents.vue';

const catalog = useCatalogStore();
const progress = useProgressStore();
const toc = useTocStore();
const { t } = useI18n();
const linkTo = useLessonLink();
const route = useRoute();

const open = ref(false);
watch(() => route.fullPath, () => { open.value = false; toc.panelOpen = false; });
// on narrow screens the lessons menu and the chapters panel take turns
watch(open, (v) => { if (v) toc.panelOpen = false; });
watch(() => toc.panelOpen, (v) => { if (v) open.value = false; });
// Escape closes the menu and the chapters panel
const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') { open.value = false; toc.panelOpen = false; } };
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
const hasChapters = computed(() => route.name === 'lesson' && toc.kind === 'lesson' && toc.sections.length > 0);
// a chapter from the phone menu: the open menu pushes the page down, so it closes before the jump
async function jumpFromMenu(id: string): Promise<void> {
  open.value = false;
  await nextTick();
  toc.jump(id);
}

const summary = computed(() => progress.summary);
const isPlan = computed(() => route.name === 'plan');
const isCurrent = (l: Lesson): boolean => route.name === 'lesson' && route.params.id === l.id;
const width = computed(() => (summary.value.ready ? `${(summary.value.done / summary.value.ready) * 100}%` : '0'));
</script>

<template>
  <div class="side">
    <div class="brand">
      <h1>Quadern de català<span>{{ t('brand.subtitle') }}</span></h1>
      <div class="brand-actions">
        <button v-if="hasChapters" class="nav-toggle toc-toggle" type="button" aria-controls="toc-panel" :aria-expanded="toc.panelOpen" @click="toc.panelOpen = !toc.panelOpen">{{ t('toc.toggle') }}</button>
        <button class="nav-toggle menu-toggle" type="button" aria-controls="nav" :aria-expanded="open" :aria-label="t('nav.toggle')" @click="open = !open"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path v-if="open" d="M4 4l10 10M14 4L4 14" /><path v-else d="M2 4h14M2 9h14M2 14h14" /></svg></button>
      </div>
    </div>
    <div class="panot" aria-hidden="true"></div>
    <nav id="nav" class="nav" :class="{ open }" :aria-label="t('nav.label')">
      <TableOfContents v-if="hasChapters" menu @jump="jumpFromMenu" />
      <p class="progress">
        <span>{{ t('progress.done', summary) }}</span>
        <span>{{ t('progress.ready', summary) }}</span>
      </p>
      <div class="progress-bar"><i :style="{ width }"></i></div>
      <RouterLink class="sync-link" :to="{ name: 'sync', params: { lang: catalog.lang } }">
        <span class="sync-icon" aria-hidden="true">⇅</span><SyncStatusLine />
      </RouterLink>
      <ul class="lesson-list">
        <li>
          <RouterLink class="plan-link" :to="{ name: 'plan', params: { lang: catalog.lang } }" :aria-current="isPlan ? 'page' : undefined" active-class="" exact-active-class="">
            <span class="n">☰</span>
            <span><span class="t">{{ t('nav.plan') }}</span><span class="s">{{ t('nav.planSub', { course: catalog.catalog.course.title ?? '' }) }}</span></span>
          </RouterLink>
        </li>
        <template v-if="catalog.extras.length">
          <li class="part-h">{{ t('nav.extras') }}</li>
          <li v-for="l in catalog.extras" :key="l.id">
            <RouterLink :to="linkTo(l)" :class="{ soon: !l.file, done: progress.isDone(l.id) }" :aria-current="isCurrent(l) ? 'page' : undefined" active-class="" exact-active-class="">
              <LessonBadge :lesson="l" />
              <span><span class="t" lang="ca">{{ l.title }}</span><span v-if="l.subtitle" class="s">{{ l.subtitle }}</span></span>
            </RouterLink>
          </li>
        </template>
        <template v-for="p in catalog.catalog.parts" :key="p.id">
          <li class="part-h"><span lang="ca">{{ p.title }}</span> · {{ p.period }}</li>
          <li v-for="l in catalog.unitsOf(p.id)" :key="l.id">
            <RouterLink :to="linkTo(l)" :class="{ soon: !l.file, done: progress.isDone(l.id) }" :aria-current="isCurrent(l) ? 'page' : undefined" active-class="" exact-active-class="">
              <LessonBadge :lesson="l" />
              <span><span class="t" lang="ca">{{ l.title }}</span></span>
            </RouterLink>
          </li>
        </template>
      </ul>
      <p class="say-hint">{{ t('say.hint') }}</p>
    </nav>
  </div>
</template>
