<script setup lang="ts">
import { computed, ref } from 'vue';
import { useExercisesStore } from '../stores/exercises.ts';
import { useI18n } from '../composables/useI18n.ts';
import type { ChoiceItem } from '../types/index.ts';

const props = defineProps<{ id: string; items: ChoiceItem[] }>();
const exercises = useExercisesStore();
const { t } = useI18n();

const picked = ref<(number | null)[]>(props.items.map(() => null));
const last = computed(() => exercises.result(props.id));
const answered = computed(() => picked.value.every((p) => p !== null));
const score = ref(0);

function pick(i: number, option: number): void {
  if (picked.value[i] !== null) return;
  picked.value[i] = option;
  if (answered.value) score.value = exercises.finishChoice(props.id, props.items, picked.value as number[]).score;
}

const stateOf = (i: number): string => {
  const p = picked.value[i];
  const item = props.items[i];
  if (p === null || p === undefined || !item) return '';
  return exercises.isRight(item, p) ? 'is-correct' : 'is-wrong';
};

function retry(): void {
  picked.value = props.items.map(() => null);
}
</script>

<template>
  <div class="ex ex-choice">
    <ol class="ex-items">
      <li v-for="(item, i) in items" :key="i" :class="stateOf(i)">
        <span class="ex-prompt" v-html="item.prompt"></span>
        <span class="ex-options">
          <button
            v-for="(option, o) in item.options"
            :key="o"
            type="button"
            class="ex-option"
            :class="{ picked: picked[i] === o, right: picked[i] !== null && o === item.answer }"
            :disabled="picked[i] !== null"
            @click="pick(i, o)"
          >{{ option }}</button>
        </span>
        <span v-if="picked[i] !== null && item.explain" class="ex-solution">{{ item.explain }}</span>
      </li>
    </ol>
    <div class="ex-actions">
      <button v-if="answered" class="btn ex-retry" type="button" @click="retry">{{ t('ex.retry') }}</button>
      <span v-if="answered" class="ex-score">{{ t('ex.score', { score, total: items.length }) }}</span>
      <span v-else-if="last" class="ex-last">{{ t('ex.last', last) }}</span>
    </div>
  </div>
</template>
