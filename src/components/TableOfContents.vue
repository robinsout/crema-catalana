<script setup lang="ts">
import { useTocStore } from '../stores/toc.ts';
import { useProgressStore } from '../stores/progress.ts';
import { useI18n } from '../composables/useI18n.ts';

// `panel`: the chapters panel of narrow screens, opened from the header
defineProps<{ panel?: boolean }>();
const toc = useTocStore();
const progress = useProgressStore();
const { t } = useI18n();

const studied = (id: string): boolean => (toc.lesson ? progress.isSectionDone(toc.lesson, id) : false);
</script>

<template>
  <aside :id="panel ? 'toc-panel' : undefined" :class="panel ? 'toc-panel' : 'toc'" :aria-label="t('toc.label')">
    <template v-if="toc.sections.length">
      <p>{{ toc.kind === 'plan' ? t('toc.plan') : t('toc.lesson') }}</p>
      <ol>
        <li v-for="s in toc.sections" :key="s.id" :class="{ 'is-done': studied(s.id) }">
          <a href="#" :class="{ active: toc.active === s.id }" :aria-current="toc.active === s.id ? 'location' : undefined" @click.prevent="toc.jump(s.id)">
            {{ s.title }}<span v-if="studied(s.id)" class="toc-check" :title="t('section.studied')"> ✓</span>
          </a>
        </li>
      </ol>
    </template>
  </aside>
</template>
