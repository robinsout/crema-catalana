<script setup lang="ts">
import { useI18n } from '../composables/useI18n.ts';
import type { Lesson } from '../types/index.ts';

defineProps<{ lesson: Lesson; tag?: 'span' | 'div'; cls?: string }>();
const { t } = useI18n();
</script>

<template>
  <component :is="tag ?? 'span'" :class="cls ?? 'n'">{{ lesson.track === 'unit' ? lesson.unit : lesson.kind === 'overview' ? t('badge.overview') : t('badge.topic') }}</component>
</template>
