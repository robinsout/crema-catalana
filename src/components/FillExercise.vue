<script setup lang="ts">
import { computed, ref } from 'vue';
import { useExercisesStore } from '../stores/exercises.ts';
import { useI18n } from '../composables/useI18n.ts';
import type { AnswerCheck, FillItem } from '../types/index.ts';

const props = defineProps<{ id: string; items: FillItem[] }>();
const exercises = useExercisesStore();
const { t } = useI18n();

const answers = ref<string[]>(props.items.map(() => ''));
const checks = ref<AnswerCheck[] | null>(null);
const current = ref<{ score: number; total: number } | null>(null);
const last = computed(() => exercises.result(props.id));

function check(): void {
  const r = exercises.checkFill(props.id, props.items, answers.value);
  checks.value = r.checks;
  current.value = { score: r.score, total: r.total };
}

function retry(): void {
  answers.value = props.items.map(() => '');
  checks.value = null;
  current.value = null;
}
</script>

<template>
  <div class="ex ex-fill">
    <ol class="ex-items">
      <li v-for="(item, i) in items" :key="i" :class="checks ? `is-${checks[i]}` : ''">
        <span class="ex-prompt" v-html="item.prompt"></span>
        <span v-if="item.hint" class="ex-hint">{{ item.hint }}</span>
        <input
          v-model="answers[i]"
          class="ex-input"
          type="text"
          lang="ca"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          :readonly="checks !== null"
          @keydown.enter.prevent="check"
        >
        <span v-if="checks && checks[i] !== 'correct'" class="ex-solution">
          {{ t('ex.solution') }} <span lang="ca">{{ item.answers[0] }}</span>
          <template v-if="checks[i] === 'accent'"> — {{ t('ex.accent') }}</template>
        </span>
      </li>
    </ol>
    <div class="ex-actions">
      <button v-if="!checks" class="btn ex-check" type="button" @click="check">{{ t('ex.check') }}</button>
      <button v-else class="btn ex-retry" type="button" @click="retry">{{ t('ex.retry') }}</button>
      <span v-if="current" class="ex-score">{{ t('ex.score', current) }}</span>
      <span v-else-if="last" class="ex-last">{{ t('ex.last', last) }}</span>
    </div>
  </div>
</template>
