<script setup lang="ts">
import { computed } from 'vue';
import { useSyncStore } from '../stores/sync.ts';
import { useI18n } from '../composables/useI18n.ts';

const sync = useSyncStore();
const { t, formatRelative } = useI18n();

const text = computed(() => {
  switch (sync.status) {
    case 'off': return t('sync.statusOff');
    case 'syncing': return t('sync.statusSyncing');
    case 'ok': return t('sync.statusOk', { when: formatRelative(sync.lastSyncAt ?? Date.now()) });
    default:
      return sync.failure === 'offline' ? t('sync.errorOffline') : sync.failure === 'server' ? t('sync.errorServer') : t('sync.errorData');
  }
});
</script>

<template>
  <p class="sync-status" :class="sync.status">{{ text }}</p>
</template>
