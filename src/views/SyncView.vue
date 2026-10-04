<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { renderSVG } from 'uqr';
import { useCatalogStore } from '../stores/catalog.ts';
import { useSyncStore } from '../stores/sync.ts';
import { useTocStore } from '../stores/toc.ts';
import { useI18n } from '../composables/useI18n.ts';
import SyncStatusLine from '../components/SyncStatusLine.vue';

const catalog = useCatalogStore();
const sync = useSyncStore();
const toc = useTocStore();
const { t } = useI18n();

// a code from a QR code or a shared link (the router takes it out of the address)
const incoming = computed(() => sync.incoming ?? '');
const typing = ref(false);
const typed = ref('');
const badCode = ref(false);
const confirmForget = ref(false);
const copied = ref(false);

const joinLink = computed(() => {
  const base = typeof location === 'undefined' ? '' : `${location.origin}${location.pathname}`;
  return `${base}#/${catalog.lang}/sync/${sync.code ?? ''}`;
});
const qr = computed(() => (sync.code ? renderSVG(joinLink.value, { border: 2 }) : ''));

async function join(input: string): Promise<void> {
  badCode.value = !(await sync.link(input));
}

async function copyLink(): Promise<void> {
  try {
    await navigator.clipboard.writeText(joinLink.value);
    copied.value = true;
  } catch { /* the link stays on screen to copy by hand */ }
}

async function forget(): Promise<void> {
  if (!confirmForget.value) { confirmForget.value = true; return; }
  await sync.forgetEverywhere();
  confirmForget.value = false;
}

onMounted(() => toc.collect(null, 'plan'));
</script>

<template>
  <header class="lesson-head">
    <p class="eyebrow">{{ t('nav.sync') }}</p>
    <h2>{{ t('sync.title') }}</h2>
    <p class="sub">{{ t('sync.sub') }}</p>
  </header>
  <article class="lesson sync">
    <!-- shown inside a frame of another page: no actions (clickjacking) -->
    <p v-if="sync.framed" class="sync-framed">{{ t('sync.framed') }}</p>

    <!-- opened from a QR code or a link -->
    <section v-else-if="incoming && incoming !== sync.code" class="sync-card">
      <h3>{{ t('sync.joinTitle') }}</h3>
      <p>{{ sync.enabled ? t('sync.switchText') : t('sync.joinText') }}</p>
      <p class="sync-code">{{ incoming.match(/.{1,4}/g)?.join('-') }}</p>
      <div class="sync-actions">
        <button class="btn sync-join" type="button" @click="join(incoming)">{{ t('sync.join') }}</button>
      </div>
      <p v-if="badCode" class="sync-error">{{ t('sync.badCode') }}</p>
    </section>

    <template v-else-if="!sync.enabled">
      <p v-html="t('sync.intro')"></p>
      <ol class="sync-steps">
        <li>{{ t('sync.step1') }}</li>
        <li>{{ t('sync.step2') }}</li>
        <li>{{ t('sync.step3') }}</li>
      </ol>
      <div class="sync-actions">
        <button class="btn sync-enable" type="button" @click="sync.enable()">{{ t('sync.enable') }}</button>
        <button class="btn sync-have-code" type="button" @click="typing = !typing">{{ t('sync.haveCode') }}</button>
      </div>
      <form v-if="typing" class="sync-type" @submit.prevent="join(typed)">
        <label for="sync-code-input">{{ t('sync.codeLabel') }}</label>
        <input id="sync-code-input" v-model="typed" class="sync-code-input" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX-…">
        <button class="btn sync-join" type="submit">{{ t('sync.join') }}</button>
        <p v-if="badCode" class="sync-error">{{ t('sync.badCode') }}</p>
      </form>
    </template>

    <template v-else>
      <SyncStatusLine />
      <p class="meta">{{ t('sync.manualNote') }}</p>
      <section class="sync-card">
        <h3>{{ t('sync.otherDevice') }}</h3>
        <p>{{ t('sync.scan') }}</p>
        <div class="sync-qr" role="img" :aria-label="t('sync.qrLabel')" v-html="qr"></div>
        <p class="sync-link-text">{{ joinLink }}</p>
        <div class="sync-actions">
          <button class="btn" type="button" @click="copyLink">{{ copied ? t('sync.copied') : t('sync.copy') }}</button>
        </div>
        <p>{{ t('sync.orType') }}</p>
        <p class="sync-code">{{ sync.displayCode }}</p>
        <p class="meta">{{ t('sync.keepSecret') }}</p>
      </section>
      <div class="sync-actions">
        <button class="btn sync-now" type="button" :disabled="sync.status === 'syncing'" @click="sync.syncNow()">{{ t('sync.now') }}</button>
        <button class="btn sync-disable" type="button" @click="sync.disable()">{{ t('sync.disable') }}</button>
        <button class="btn sync-forget" :class="{ danger: confirmForget }" type="button" @click="forget">
          {{ confirmForget ? t('sync.forgetConfirm') : t('sync.forget') }}
        </button>
      </div>
      <p class="meta">{{ t('sync.forgetNote') }}</p>
    </template>

    <p class="meta sync-privacy">{{ t('sync.privacy') }}</p>
  </article>
</template>
