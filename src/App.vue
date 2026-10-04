<script setup lang="ts">
import { ref, watchEffect } from 'vue';
import { RouterView, useRoute } from 'vue-router';
import SideNav from './components/SideNav.vue';
import TableOfContents from './components/TableOfContents.vue';
import { useCatalogStore } from './stores/catalog.ts';
import { useTocStore } from './stores/toc.ts';
import { useI18n } from './composables/useI18n.ts';
import { useSay } from './composables/useSay.ts';
import { useSectionSpy } from './composables/useSectionSpy.ts';

const catalog = useCatalogStore();
const toc = useTocStore();
const route = useRoute();
const { t } = useI18n();
const main = ref<HTMLElement | null>(null);
useSay(main);
useSectionSpy();

// shown when even the interface strings could not be loaded
const loadError = () => (catalog.ui['status.catalogError'] ? t('status.catalogError') : 'Could not load the course. Please reload the page.');

const SITE = 'Quadern de català';
function pageName(): string {
  if (!catalog.ready) return '';
  if (route.name === 'lesson') return catalog.find(String(route.params.id ?? ''))?.title ?? '';
  if (route.name === 'plan') return t('nav.plan');
  if (route.name === 'sync') return t('nav.sync');
  return '';
}

watchEffect(() => {
  if (catalog.lang) document.documentElement.lang = catalog.lang;
  const name = pageName();
  document.title = name ? `${name} · ${SITE}` : SITE;
});

const skipToContent = (): void => main.value?.focus();
</script>

<template>
  <div class="app">
    <a class="skip-link" href="#main" @click.prevent="skipToContent">{{ catalog.ready ? t('nav.skip') : '' }}</a>
    <SideNav v-if="catalog.ready" />
    <main id="main" ref="main" tabindex="-1">
      <p v-if="catalog.error" class="status">{{ loadError() }}</p>
      <RouterView v-else />
    </main>
    <TableOfContents v-if="catalog.ready" />
    <TableOfContents v-if="catalog.ready && toc.panelOpen" panel />
  </div>
</template>
