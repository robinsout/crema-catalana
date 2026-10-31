<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useCatalogStore } from '../stores/catalog.ts';
import { useProgressStore } from '../stores/progress.ts';
import { useTocStore } from '../stores/toc.ts';
import { useTrainerStore } from '../stores/trainer.ts';
import { useVerbsStore } from '../stores/verbs.ts';
import { useI18n } from '../composables/useI18n.ts';
import { useLessonLink } from '../composables/useLessonLink.ts';
import type { Lesson } from '../types/index.ts';
import LessonBadge from './LessonBadge.vue';
import SyncStatusLine from './SyncStatusLine.vue';
import TableOfContents from './TableOfContents.vue';

const catalog = useCatalogStore();
const progress = useProgressStore();
const toc = useTocStore();
const { t } = useI18n();
const linkTo = useLessonLink();
const route = useRoute();
const router = useRouter();

// the same page in another language (the router remembers it as the language of this device)
// iOS shows the options of a <select> in a native menu, often right over the sync link, and the tap
// that picks an option can reach the page too ("ghost click"). While the language switches (the
// other language loads, the menu is still open) and a moment after, taps on the page are ignored.
const GHOST_CLICK_MS = 400;
let switching = false;
let switchedAt = 0;
// The menu stays open after a switch; texts and chapters change length in the other language,
// so the menu is scrolled to keep the switcher where it was on the screen.
const side = ref<HTMLElement | null>(null);
const nav = ref<HTMLElement | null>(null);
const select = ref<HTMLSelectElement | null>(null);
let anchor: { top: number; until: number } | null = null;
function keepSwitcherInPlace(): void {
  if (!anchor || !select.value || Date.now() > anchor.until) { anchor = null; return; }
  const box = [nav.value, side.value].find((el) => el && el.scrollHeight > el.clientHeight);
  const shift = select.value.getBoundingClientRect().top - anchor.top;
  if (box && shift) box.scrollTop += shift;
}
watch(() => [toc.sections, catalog.lang], () => { void nextTick(keepSwitcherInPlace); }, { flush: 'post' });

async function switchLanguage(e: Event): Promise<void> {
  const lang = (e.target as HTMLSelectElement).value;
  if (!route.name || lang === catalog.lang) return;
  if (select.value) anchor = { top: select.value.getBoundingClientRect().top, until: Date.now() + 3000 };
  switching = true;
  try {
    await router.push({ name: route.name, params: { ...route.params, lang } });
  } finally {
    switching = false;
    switchedAt = Date.now();
  }
}
const swallowGhostClick = (e: MouseEvent): void => {
  if (switching || Date.now() - switchedAt < GHOST_CLICK_MS) { e.preventDefault(); e.stopPropagation(); }
};

const open = ref(false);
// a new page closes the menu and the chapters panel; switching the language keeps the menu open,
// so the reader sees it change instead of being dropped onto the page
watch(() => route.fullPath, () => { if (switching) return; open.value = false; toc.panelOpen = false; });
// on narrow screens the lessons menu and the chapters panel take turns
watch(open, (v) => { if (v) toc.panelOpen = false; });
watch(() => toc.panelOpen, (v) => { if (v) open.value = false; });
// Escape closes the menu and the chapters panel
const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') { open.value = false; toc.panelOpen = false; } };
// the height of the sticky header of phones (it depends on the notch and the fonts): sticky parts of a
// page, like the verb search, stay right below it (--phone-header, used only on narrow screens)
let headerSize: ResizeObserver | null = null;
const brandBox = ref<HTMLElement | null>(null);
function measureHeader(): void {
  if (!side.value || open.value) return; // the open menu fills the screen: keep the closed height
  document.documentElement.style.setProperty('--phone-header', `${side.value.getBoundingClientRect().height}px`);
}
onMounted(() => {
  window.addEventListener('keydown', onKey);
  document.addEventListener('click', swallowGhostClick, true);
  if (typeof ResizeObserver !== 'undefined' && brandBox.value) {
    headerSize = new ResizeObserver(measureHeader);
    headerSize.observe(brandBox.value);
  }
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey);
  document.removeEventListener('click', swallowGhostClick, true);
  headerSize?.disconnect();
});
const hasChapters = computed(() => ((route.name === 'lesson' && toc.kind === 'lesson') || (route.name === 'verb' && toc.kind === 'verb')) && toc.sections.length > 0);
// a chapter from the phone menu: the open menu pushes the page down, so it closes before the jump
async function jumpFromMenu(id: string): Promise<void> {
  open.value = false;
  await nextTick();
  toc.jump(id);
}

// the two areas: lessons, and verbs (the reference and the trainer); each link goes back to where the reader was
const inVerbs = computed(() => route.name === 'verbs' || route.name === 'verb' || route.name === 'trainer');
const lessonsLink = computed(() => {
  const l = progress.lastLesson ? catalog.find(progress.lastLesson) : null;
  return l ? linkTo(l) : { name: 'plan', params: { lang: catalog.lang } };
});
const verbsLink = computed(() => ({ name: progress.verbsTab, params: { lang: catalog.lang } }));
// the verbs menu: the trainer's day, search, the tense choice, the verbs opened last
const trainer = useTrainerStore();
const verbs = useVerbsStore();
const goalWidth = computed(() => `${Math.min(100, (trainer.day.done / trainer.settings.goal) * 100)}%`);
const search = ref('');
function searchVerbs(): void {
  const q = search.value.trim();
  void router.push({ name: 'verbs', params: { lang: catalog.lang }, query: q ? { q } : {} });
  search.value = '';
}
function openTenses(): void {
  verbs.settingsOpen = true;
  if (route.name !== 'verbs' && route.name !== 'verb' && route.name !== 'trainer') void router.push({ name: 'verbs', params: { lang: catalog.lang } });
  else void nextTick(() => toc.jump('tense-settings'));
}
watch(() => catalog.lang, (lang) => { if (inVerbs.value) void verbs.load(lang); });
const recent = computed(() => progress.recentVerbs.map((id) => ({ id, tr: verbs.find(id)?.tr ?? '' })));

const summary = computed(() => progress.summary);
const isPlan = computed(() => route.name === 'plan');
const isCurrent = (l: Lesson): boolean => route.name === 'lesson' && route.params.id === l.id;
const width = computed(() => (summary.value.ready ? `${(summary.value.done / summary.value.ready) * 100}%` : '0'));
</script>

<template>
  <div ref="side" class="side" :class="{ 'menu-open': open }">
    <div ref="brandBox" class="brand">
      <h1>Quadern <br>de català</h1>
      <nav class="pills area-switch" :aria-label="t('nav.areas')">
        <RouterLink :to="lessonsLink" :aria-current="inVerbs ? undefined : 'page'" active-class="" exact-active-class="">{{ t('nav.lessons') }}</RouterLink>
        <RouterLink :to="verbsLink" :aria-current="inVerbs ? 'page' : undefined" active-class="" exact-active-class="">{{ t('nav.verbs') }}</RouterLink>
      </nav>
      <div class="brand-actions">
        <button v-if="hasChapters" class="nav-toggle toc-toggle" type="button" aria-controls="toc-panel" :aria-expanded="toc.panelOpen" @click="toc.panelOpen = !toc.panelOpen">{{ toc.kind === 'verb' ? t('toc.toggleVerb') : t('toc.toggle') }}</button>
        <button class="nav-toggle menu-toggle" type="button" aria-controls="nav" :aria-expanded="open" :aria-label="t('nav.toggle')" @click="open = !open"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path v-if="open" d="M4 4l10 10M14 4L4 14" /><path v-else d="M2 4h14M2 9h14M2 14h14" /></svg></button>
      </div>
    </div>
    <div class="panot" aria-hidden="true"></div>
    <nav id="nav" ref="nav" class="nav" :class="{ open }" :aria-label="t('nav.label')">
      <TableOfContents v-if="hasChapters" menu @jump="jumpFromMenu" />
      <template v-if="inVerbs">
        <p class="goal-line"><RouterLink :to="{ name: 'trainer', params: { lang: catalog.lang } }">{{ t('nav.trainerToday') }}</RouterLink><b>{{ t('nav.trainerGoal', { n: trainer.day.done, goal: trainer.settings.goal }) }}</b></p>
        <div class="progress-bar"><i :style="{ width: goalWidth }"></i></div>
      </template>
      <template v-else>
        <p class="progress">
          <span>{{ t('progress.done', summary) }}</span>
          <span>{{ t('progress.ready', summary) }}</span>
        </p>
        <div class="progress-bar"><i :style="{ width }"></i></div>
      </template>
      <RouterLink class="sync-link" :to="{ name: 'sync', params: { lang: catalog.lang } }">
        <span class="sync-icon" aria-hidden="true">⇅</span><SyncStatusLine />
      </RouterLink>
      <label v-if="catalog.languages.length > 1" class="lang-pick">
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="6.3" /><path d="M1.7 8h12.6M8 1.7c2 2 2 10.6 0 12.6M8 1.7c-2 2-2 10.6 0 12.6" /></svg>
        <select ref="select" class="lang-select" :aria-label="t('nav.language')" :value="catalog.lang" @change="switchLanguage">
          <option v-for="l in catalog.languages" :key="l.code" :value="l.code" :lang="l.code">{{ l.name }}</option>
        </select>
      </label>
      <template v-if="inVerbs">
        <form class="side-search" role="search" @submit.prevent="searchVerbs">
          <input v-model="search" type="search" :placeholder="t('verbs.search')" :aria-label="t('verbs.searchLabel')" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search">
        </form>
        <a class="side-tenses" href="#tense-settings" @click.prevent="openTenses">{{ t('verbs.configure', { on: progress.verbTenses.length, total: verbs.tenses.length }) }}</a>
        <ul v-if="recent.length" class="lesson-list">
          <li class="part-h">{{ t('nav.recent') }}</li>
          <li v-for="v in recent" :key="v.id" class="recent">
            <RouterLink :to="{ name: 'verb', params: { lang: catalog.lang, verb: v.id } }" active-class="" exact-active-class="">
              <span><span class="t" lang="ca">{{ v.id }}</span><span v-if="v.tr" class="s">{{ v.tr }}</span></span>
            </RouterLink>
          </li>
        </ul>
      </template>
      <ul v-else class="lesson-list">
        <li>
          <RouterLink class="plan-link" :to="{ name: 'plan', params: { lang: catalog.lang } }" :aria-current="isPlan ? 'page' : undefined" active-class="" exact-active-class="">
            <span class="n">☰</span>
            <span><span class="t">{{ t('nav.plan') }}</span><span class="s">{{ t('nav.planSub', { course: catalog.catalog.course.title ?? '' }) }}</span></span>
          </RouterLink>
        </li>
        <template v-if="catalog.extras.length">
          <li class="part-h">{{ t('nav.extras') }}</li>
          <li v-for="l in catalog.extras" :key="l.id">
            <RouterLink :to="linkTo(l)" :class="{ soon: !l.file, done: progress.isDone(l.id) }" :aria-current="isCurrent(l) ? 'page' : undefined" active-class="" exact-active-class="">
              <LessonBadge :lesson="l" />
              <span><span class="t" lang="ca">{{ l.title }}</span><span v-if="l.subtitle" class="s">{{ l.subtitle }}</span></span>
            </RouterLink>
          </li>
        </template>
        <template v-for="p in catalog.catalog.parts" :key="p.id">
          <li class="part-h"><span lang="ca">{{ p.title }}</span> · {{ p.period }}</li>
          <li v-for="l in catalog.unitsOf(p.id)" :key="l.id">
            <RouterLink :to="linkTo(l)" :class="{ soon: !l.file, done: progress.isDone(l.id) }" :aria-current="isCurrent(l) ? 'page' : undefined" active-class="" exact-active-class="">
              <LessonBadge :lesson="l" />
              <span><span class="t" lang="ca">{{ l.title }}</span></span>
            </RouterLink>
          </li>
        </template>
      </ul>
      <p v-if="!inVerbs" class="say-hint">{{ t('say.hint') }}</p>
    </nav>
  </div>
</template>
