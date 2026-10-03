<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useTocStore } from '../stores/toc.ts';
import { useI18n } from '../composables/useI18n.ts';

const toc = useTocStore();
const { t } = useI18n();
const active = ref('');
let spy: IntersectionObserver | null = null;

function observe(): void {
  spy?.disconnect();
  if (typeof IntersectionObserver === 'undefined') return;
  spy = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) active.value = e.target.id;
  }, { rootMargin: '-20% 0px -70% 0px' });
  for (const s of toc.sections) {
    const el = document.getElementById(s.id);
    if (el) spy.observe(el);
  }
}

watch(() => toc.sections, () => nextTick(observe));
onBeforeUnmount(() => spy?.disconnect());

const jump = (id: string): void => document.getElementById(id)?.scrollIntoView();
</script>

<template>
  <aside class="toc" :aria-label="t('toc.label')">
    <template v-if="toc.sections.length">
      <p>{{ toc.kind === 'plan' ? t('toc.plan') : t('toc.lesson') }}</p>
      <ol>
        <li v-for="s in toc.sections" :key="s.id">
          <a href="#" :class="{ active: active === s.id }" @click.prevent="jump(s.id)">{{ s.title }}</a>
        </li>
      </ol>
    </template>
  </aside>
</template>
