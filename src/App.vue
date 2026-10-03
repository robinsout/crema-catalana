<script setup lang="ts">
import { ref, watchEffect } from 'vue';
import { RouterView } from 'vue-router';
import SideNav from './components/SideNav.vue';
import TableOfContents from './components/TableOfContents.vue';
import { useCatalogStore } from './stores/catalog.ts';
import { useI18n } from './composables/useI18n.ts';
import { useSay } from './composables/useSay.ts';
import { useSyncStore } from './stores/sync.ts';

const catalog = useCatalogStore();
const { t } = useI18n();
const main = ref<HTMLElement | null>(null);
useSay(main);

// shown when even the interface strings could not be loaded
const loadError = () => (catalog.ui['status.catalogError'] ? t('status.catalogError') : 'Could not load the course. Please reload the page.');

const sync = useSyncStore();
watchEffect(() => {
  if (catalog.lang) document.documentElement.lang = catalog.lang;
  if (catalog.ready) sync.start();
});
</script>

<template>
  <div class="app">
    <SideNav v-if="catalog.ready" />
    <main id="main" ref="main">
      <p v-if="catalog.error" class="status">{{ loadError() }}</p>
      <RouterView v-else />
    </main>
    <TableOfContents v-if="catalog.ready" />
  </div>
</template>
