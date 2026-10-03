<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { useCatalogStore } from '../stores/catalog.ts';
import { useProgressStore } from '../stores/progress.ts';
import { useI18n } from '../composables/useI18n.ts';
import { useLessonLink } from '../composables/useLessonLink.ts';
import type { Lesson } from '../types/index.ts';
import LessonBadge from './LessonBadge.vue';

const catalog = useCatalogStore();
const progress = useProgressStore();
const { t } = useI18n();
const linkTo = useLessonLink();
const route = useRoute();

const open = ref(false);
watch(() => route.fullPath, () => { open.value = false; });

const summary = computed(() => progress.summary);
const isPlan = computed(() => route.name === 'plan');
const isCurrent = (l: Lesson): boolean => route.name === 'lesson' && route.params.id === l.id;
const width = computed(() => (summary.value.ready ? `${(summary.value.done / summary.value.ready) * 100}%` : '0'));
</script>

<template>
  <div class="side">
    <div class="brand">
      <h1>Quadern de català<span>{{ t('brand.subtitle') }}</span></h1>
      <button class="nav-toggle" type="button" aria-controls="nav" :aria-expanded="open" @click="open = !open">{{ t('nav.toggle') }}</button>
    </div>
    <div class="panot" aria-hidden="true"></div>
    <nav id="nav" class="nav" :class="{ open }" :aria-label="t('nav.label')">
      <p class="progress">
        <span>{{ t('progress.done', summary) }}</span>
        <span>{{ t('progress.ready', summary) }}</span>
      </p>
      <div class="progress-bar"><i :style="{ width }"></i></div>
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
