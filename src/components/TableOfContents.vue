<script setup lang="ts">
import { computed } from 'vue';
import { useTocStore } from '../stores/toc.ts';
import { useProgressStore } from '../stores/progress.ts';
import { useVerbsStore } from '../stores/verbs.ts';
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
const heading = computed(() => (toc.kind === 'plan' ? t('toc.plan') : toc.kind === 'verb' ? t('toc.verb') : t('toc.lesson')));
// a group heading above the first section of each group
const startsGroup = (i: number): boolean => !!toc.sections[i]?.group && toc.sections[i]?.group !== toc.sections[i - 1]?.group;
// verb pages: the last line opens the tense choice
const verbs = useVerbsStore();
const tensesOn = computed(() => progress.verbTenses.length);
const openSettings = (): void => { verbs.settingsOpen = true; go('tense-settings'); };
</script>

<template>
  <aside :id="panel ? 'toc-panel' : undefined" :class="kindClass" :aria-label="t('toc.label')">
    <template v-if="toc.sections.length">
      <p>{{ heading }}</p>
      <ol>
        <template v-for="(s, i) in toc.sections" :key="s.id">
          <!-- a group of one section of the same name (Imperatiu) is a link itself -->
          <li v-if="s.title === s.group" class="toc-group">
            <a href="#" :class="{ active: toc.active === s.id }" :aria-current="toc.active === s.id ? 'location' : undefined" lang="ca" @click.prevent="go(s.id)">{{ s.title }}</a>
          </li>
          <li v-else-if="startsGroup(i)" class="toc-group" lang="ca">{{ s.group }}</li>
          <li v-if="s.title !== s.group" :class="{ 'is-done': studied(s.id) }">
            <a href="#" :class="{ active: toc.active === s.id }" :aria-current="toc.active === s.id ? 'location' : undefined" :lang="toc.kind === 'verb' ? 'ca' : undefined" @click.prevent="go(s.id)">
              {{ s.title }}<span v-if="studied(s.id)" class="toc-check" :title="t('section.studied')"> ✓</span>
            </a>
          </li>
        </template>
      </ol>
    </template>
    <a v-if="toc.kind === 'verb'" href="#" class="toc-settings" @click.prevent="openSettings">{{ t('verbs.configure', { on: tensesOn, total: verbs.tenses.length }) }}</a>
  </aside>
</template>
