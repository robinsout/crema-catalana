// Pronunciation: a click on a Catalan phrase in the content plays its recorded clip.
import { onBeforeUnmount, onMounted, watchEffect, type Ref } from 'vue';
import { useRoute } from 'vue-router';
import { useAudioStore } from '../stores/audio.ts';
import { useVisitsStore } from '../stores/visits.ts';

export function useSay(root: Ref<HTMLElement | null>) {
  const audio = useAudioStore();
  const visits = useVisitsStore();
  const route = useRoute();
  const player = typeof Audio === 'undefined' ? null : new Audio();

  function onClick(e: MouseEvent): void {
    const target = e.target as Element | null;
    if (!audio.available || !player || !target || target.closest('summary, a, button')) return;
    const host = target.closest<HTMLElement>('.lesson [lang="ca"]');
    if (!host) return;
    const el = host.tagName === 'TABLE' ? target.closest<HTMLElement>('td') : host;
    const clip = el ? audio.clip(el.textContent) : null;
    if (!el || !clip) return;
    document.querySelectorAll('.speaking').forEach((n) => n.classList.remove('speaking'));
    el.classList.add('speaking');
    const stop = () => el.classList.remove('speaking');
    player.onended = stop;
    player.onerror = stop;
    player.src = clip;
    player.play().catch(stop);
    if (route.name === 'lesson' && typeof route.params.id === 'string') visits.audio(route.params.id);
  }

  // phrases look clickable only when there is audio
  watchEffect(() => document.documentElement.classList.toggle('can-say', audio.available));

  // the audio index is loaded by the pages with phrases, once their own content is there
  onMounted(() => root.value?.addEventListener('click', onClick));
  onBeforeUnmount(() => root.value?.removeEventListener('click', onClick));
}
