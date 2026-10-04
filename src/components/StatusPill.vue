<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { useProgressStore } from '../stores/progress.ts';
import { useI18n } from '../composables/useI18n.ts';
import { useLessonLink } from '../composables/useLessonLink.ts';
import type { Lesson } from '../types/index.ts';

defineProps<{ lesson: Lesson }>();
const progress = useProgressStore();
const { t } = useI18n();
const linkTo = useLessonLink();
</script>

<template>
  <RouterLink v-if="lesson.file" class="pill ok" :class="{ done: progress.isDone(lesson.id) }" :to="linkTo(lesson)">{{ progress.isDone(lesson.id) ? t('pill.done') : t('pill.open') }}</RouterLink>
  <span v-else class="pill">{{ t('pill.soon') }}</span>
</template>
