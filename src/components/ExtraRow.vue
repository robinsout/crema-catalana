<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { useCatalogStore } from '../stores/catalog.ts';
import { useI18n } from '../composables/useI18n.ts';
import { useLessonLink } from '../composables/useLessonLink.ts';
import { lessonLabel } from '../lib/model.ts';
import type { Lesson } from '../lib/types.ts';
import StatusPill from './StatusPill.vue';
import LessonBadge from './LessonBadge.vue';

const props = defineProps<{ lesson: Lesson; focused: boolean }>();
const catalog = useCatalogStore();
const { t } = useI18n();
const linkTo = useLessonLink();
const units = computed(() => (props.lesson.related ?? []).map((id) => catalog.find(id)).filter((u): u is Lesson => u !== null));
const partOf = (u: Lesson): string => (u.track === 'unit' ? u.part.title : '');
</script>

<template>
  <div :id="`u-${lesson.id}`" class="unit" :class="{ focus: focused }">
    <LessonBadge :lesson="lesson" tag="div" cls="unit-n" />
    <div class="unit-body">
      <div class="unit-top"><h3 lang="ca">{{ lesson.title }}</h3><StatusPill :lesson="lesson" /></div>
      <p class="unit-topic">{{ lessonLabel(lesson, t) }}<template v-if="lesson.subtitle"> · {{ lesson.subtitle }}</template></p>
      <dl v-if="units.length" class="unit-dl">
        <dt>{{ t('plan.forUnits') }}</dt>
        <dd><template v-for="(u, i) in units" :key="u.id">{{ i ? ', ' : '' }}<RouterLink :to="linkTo(u)">{{ partOf(u) }} · {{ u.unit }}</RouterLink></template></dd>
      </dl>
    </div>
  </div>
</template>
