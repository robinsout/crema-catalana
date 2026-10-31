<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router';
import { useCatalogStore } from '../stores/catalog.ts';
import { useI18n } from '../composables/useI18n.ts';

// The two tools of the "Verbs" area: the reference (list and verb pages) and the trainer
const catalog = useCatalogStore();
const route = useRoute();
const { t } = useI18n();
const isTrainer = (): boolean => route.name === 'trainer';
</script>

<template>
  <nav class="area-tabs" :aria-label="t('nav.verbs')">
    <RouterLink :to="{ name: 'verbs', params: { lang: catalog.lang } }" :aria-current="isTrainer() ? undefined : 'page'" active-class="" exact-active-class="">{{ t('verbs.reference') }}</RouterLink>
    <RouterLink :to="{ name: 'trainer', params: { lang: catalog.lang } }" :aria-current="isTrainer() ? 'page' : undefined" active-class="" exact-active-class="">{{ t('nav.trainer') }}</RouterLink>
  </nav>
</template>
