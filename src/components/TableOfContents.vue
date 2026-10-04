<script setup lang="ts">
import { computed } from 'vue';
import { useTocStore } from '../stores/toc.ts';
import { useProgressStore } from '../stores/progress.ts';
import { useI18n } from '../composables/useI18n.ts';

// `panel`: the chapters panel of mid-width screens, opened from the header;
// `menu`: the chapters at the top of the phone menu, which closes itself before the jump (`jump`)
const props = defineProps<{ panel?: boolean; menu?: boolean }>();
const emit = defineEmits<{ jump: [id: string] }>();
const toc = useTocStore();
const progress = useProgressStore();
const { t } = useI18n();

const kindClass = computed(() => (props.menu ? 'nav-chapters' : props.panel ? 'toc-panel' : 'toc'));
const studied = (id: string): boolean => (toc.lesson ? progress.isSectionDone(toc.lesson, id) : false);
const go = (id: string): void => (props.menu ? emit('jump', id) : toc.jump(id));
</script>

<template>
  <aside :id="panel ? 'toc-panel' : undefined" :class="kindClass" :aria-label="t('toc.label')">
    <template v-if="toc.sections.length">
      <p>{{ toc.kind === 'plan' ? t('toc.plan') : t('toc.lesson') }}</p>
      <ol>
        <li v-for="s in toc.sections" :key="s.id" :class="{ 'is-done': studied(s.id) }">
          <a href="#" :class="{ active: toc.active === s.id }" :aria-current="toc.active === s.id ? 'location' : undefined" @click.prevent="go(s.id)">
            {{ s.title }}<span v-if="studied(s.id)" class="toc-check" :title="t('section.studied')"> ✓</span>
          </a>
        </li>
      </ol>
    </template>
  </aside>
</template>
