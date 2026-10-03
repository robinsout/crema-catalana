// Pronunciation clips. One shared index for all lessons, audio/index.json:
//   { voice, rate, clips: { "<normalized Catalan text>": "clips/<hash>.mp3" } }
// The page looks a clicked phrase up by its normalized text.

import type { AudioIndex } from '../types/index.ts';

export type { AudioIndex };

export const normalizeSayText = (text: unknown): string => String(text ?? '').replace(/\s+/g, ' ').trim();

// Text sent to the speech engine: syllable dots (ca·sa) and suffix dashes (-gut) are dropped,
// the ela geminada (l·l) stays, an exercise blank (___) becomes a pause.
export const ttsText = (text: string): string => normalizeSayText(text)
  .replace(/·/g, (dot, i: number, s: string) => (s[i - 1] === 'l' && s[i + 1] === 'l' ? dot : ''))
  .replace(/^-+/, '')
  .replace(/_{2,}/g, '…');

export function clipFor(index: AudioIndex | null | undefined, text: string | null | undefined): string | null {
  if (!index || !index.clips) return null;
  return index.clips[normalizeSayText(text)] ?? null;
}
