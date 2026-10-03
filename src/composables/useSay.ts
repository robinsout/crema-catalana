// Pronunciation: a click on a Catalan phrase in the content plays its recorded clip.
import { onBeforeUnmount, onMounted, type Ref } from 'vue';
import { clipFor, type AudioIndex } from '../lib/say.ts';

let indexPromise: Promise<AudioIndex | null> | null = null;
const loadIndex = (): Promise<AudioIndex | null> => {
  indexPromise ??= fetch('audio/index.json')
    .then((r) => (r.ok ? (r.json() as Promise<AudioIndex>) : null))
    .catch(() => null);
  return indexPromise;
};

export function useSay(root: Ref<HTMLElement | null>) {
  let index: AudioIndex | null = null;
  const player = typeof Audio === 'undefined' ? null : new Audio();

  function onClick(e: MouseEvent): void {
    const target = e.target as Element | null;
    if (!index || !player || !target || target.closest('summary, a, button')) return;
    const host = target.closest<HTMLElement>('.lesson [lang="ca"]');
    if (!host) return;
    const el = host.tagName === 'TABLE' ? target.closest<HTMLElement>('td') : host;
    const clip = el ? clipFor(index, el.textContent) : null;
    if (!el || !clip) return;
    document.querySelectorAll('.speaking').forEach((n) => n.classList.remove('speaking'));
    el.classList.add('speaking');
    const stop = () => el.classList.remove('speaking');
    player.onended = stop;
    player.onerror = stop;
    player.src = `audio/${clip}`;
    player.play().catch(stop);
  }

  onMounted(async () => {
    root.value?.addEventListener('click', onClick);
    index = await loadIndex();
    document.documentElement.classList.toggle('can-say', !!index);
  });
  onBeforeUnmount(() => root.value?.removeEventListener('click', onClick));
}
