// Pronunciation clips. One shared index for all lessons, audio/index.json:
//   { voice, rate, clips: { "<normalized Catalan text>": "clips/<hash>.mp3" } }
// The page looks a clicked phrase up by its normalized text.

export const normalizeSayText = (text) => String(text == null ? '' : text).replace(/\s+/g, ' ').trim();

// Text sent to the speech engine: syllable dots (ca·sa) and suffix dashes (-gut) are dropped,
// the ela geminada (l·l) stays.
export const ttsText = (text) => normalizeSayText(text)
  .replace(/·/g, (dot, i, s) => (s[i - 1] === 'l' && s[i + 1] === 'l' ? dot : ''))
  .replace(/^-+/, '');

export function clipFor(manifest, text) {
  if (!manifest || !manifest.clips) return null;
  return manifest.clips[normalizeSayText(text)] || null;
}
