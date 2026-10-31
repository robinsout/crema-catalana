<script setup lang="ts">
import { useUpdateStore } from '../stores/update.ts';
import { useI18n } from '../composables/useI18n.ts';

const update = useUpdateStore();
const { t } = useI18n();
</script>

<template>
  <div v-if="update.available" class="update-notice" role="status">
    <span>{{ t('update.ready') }}</span>
    <button type="button" class="btn btn-solid" @click="update.reload()">{{ t('update.reload') }}</button>
  </div>
</template>
