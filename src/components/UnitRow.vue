<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { useCatalogStore } from '../stores/catalog.ts';
import { useI18n } from '../composables/useI18n.ts';
import { useLessonLink } from '../composables/useLessonLink.ts';
import type { Lesson } from '../types/index.ts';
import StatusPill from './StatusPill.vue';

const props = defineProps<{ lesson: Lesson; focused: boolean }>();
const catalog = useCatalogStore();
const { t } = useI18n();
const linkTo = useLessonLink();
const related = computed(() => catalog.relatedTo(props.lesson.id));
</script>

<template>
  <div :id="`u-${lesson.id}`" class="unit" :class="{ focus: focused, soon: !lesson.file }">
    <div class="unit-n">{{ lesson.unit }}</div>
    <div class="unit-body">
      <div class="unit-top"><h3 lang="ca">{{ lesson.title }}</h3><StatusPill :lesson="lesson" /></div>
      <p class="unit-topic">{{ lesson.topic }}</p>
      <!-- a unit without a lesson yet is folded: the plan stays short and the ready lessons stand out -->
      <component :is="lesson.file ? 'div' : 'details'" class="unit-more" :open="lesson.file ? undefined : focused">
        <summary v-if="!lesson.file">{{ t('plan.unitDetails') }}</summary>
        <ul class="chips"><li v-for="g in lesson.grammar ?? []" :key="g">{{ g }}</li></ul>
        <dl class="unit-dl">
          <dt>{{ t('plan.vocab') }}</dt><dd>{{ lesson.vocab }}</dd>
          <dt>{{ t('plan.extra') }}</dt><dd>{{ lesson.extra }}</dd>
          <dt>{{ t('plan.mission') }}</dt><dd>{{ lesson.mission }}</dd>
          <template v-if="related.length">
            <dt>{{ t('plan.topics') }}</dt>
            <dd><template v-for="(x, i) in related" :key="x.id">{{ i ? ', ' : '' }}<RouterLink :to="linkTo(x)" lang="ca">{{ x.title }}</RouterLink></template></dd>
          </template>
        </dl>
      </component>
    </div>
  </div>
</template>
