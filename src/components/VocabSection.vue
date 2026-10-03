<script setup lang="ts">
import { useI18n } from '../composables/useI18n.ts';
import type { Gender, VocabGroup } from '../types/index.ts';

defineProps<{ groups: VocabGroup[] }>();
const { t } = useI18n();
// explicit keys, so the check of interface strings can see them
const gender = (g: Gender): string => (g === 'm' ? t('vocab.m') : g === 'f' ? t('vocab.f') : t('vocab.mf'));
</script>

<template>
  <section id="vocab" class="vocab">
    <h2>{{ t('vocab.title') }}</h2>
    <template v-for="g in groups" :key="g.id">
      <h3 v-if="g.title">{{ g.title }}</h3>
      <div class="tw">
        <table class="vocab-table">
          <tbody>
            <tr v-for="w in g.words" :key="w.id">
              <th scope="row">
                <span class="vocab-ca" lang="ca">{{ w.ca }}</span>
                <span v-if="w.gender || w.plural" class="vocab-meta">
                  <template v-if="w.gender">{{ gender(w.gender) }}</template>
                  <template v-if="w.plural"> · {{ t('vocab.plural') }} <span lang="ca">{{ w.plural }}</span></template>
                </span>
              </th>
              <td class="vocab-tr">{{ w.tr }}<span v-if="w.note" class="vocab-note">{{ w.note }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>
