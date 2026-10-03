// Records pronunciation clips for every Catalan phrase in the lessons and the study plan.
// Uses edge-tts (Microsoft neural voices): pip install edge-tts, or set EDGE_TTS=/path/to/edge-tts.
//
// Shared store: audio/index.json maps a phrase to clips/<hash>.mp3, one file per phrase, so a
// phrase used in several lessons (or, later, several languages) is recorded once.
// Only new phrases are recorded; clips of phrases that are no longer used are deleted.
// Runs locally only; the clips are committed, CI just checks they are complete.
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { normalizeCatalog, allLessons } from '../portal/js/model.js';
import { normalizeSayText, ttsText } from '../portal/js/say.js';
import { extractSayTexts } from './lib/say-texts.mjs';

const run = promisify(execFile);
const VOICE = 'ca-ES-JoanaNeural';
const RATE = '-10%';
const EDGE_TTS = process.env.EDGE_TTS || 'edge-tts';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const portal = join(root, 'portal');
const audioDir = join(portal, 'audio');
const clipsDir = join(audioDir, 'clips');
const indexPath = join(audioDir, 'index.json');

const catalog = normalizeCatalog(JSON.parse(readFileSync(join(portal, 'lessons.json'), 'utf8')));
const texts = [...new Set([
  ...allLessons(catalog).filter((l) => l.file).flatMap((l) => extractSayTexts(readFileSync(join(portal, l.file), 'utf8'))),
  ...allLessons(catalog).map((l) => normalizeSayText(l.title)),
])];

const old = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, 'utf8')) : { clips: {} };
const sameVoice = old.voice === undefined || (old.voice === VOICE && old.rate === RATE);
mkdirSync(clipsDir, { recursive: true });

const clips = {};
const todo = [];
for (const t of texts) {
  const file = clipName(t);
  if (sameVoice && existsSync(join(audioDir, file))) clips[t] = file;
  else todo.push(t);
}

let done = 0;
const failed = [];
await pool(todo, 2, async (t) => {
  const file = clipName(t);
  try {
    await say(ttsText(t), join(audioDir, file));
    clips[t] = file;
  } catch (e) {
    failed.push(t);
  }
  process.stdout.write(`\r${++done}/${todo.length} new clips`);
});
if (todo.length) process.stdout.write('\n');

// drop clips nobody uses any more
const keep = new Set(Object.values(clips));
for (const f of readdirSync(clipsDir)) {
  if (!keep.has(`clips/${f}`)) rmSync(join(clipsDir, f), { force: true });
}

const sorted = Object.fromEntries(Object.keys(clips).sort().map((t) => [t, clips[t]]));
writeFileSync(indexPath, JSON.stringify({ voice: VOICE, rate: RATE, clips: sorted }, null, 1) + '\n');
console.log(`audio: ${texts.length} phrases, ${todo.length - failed.length} recorded, ${keep.size} clips`);
if (failed.length) {
  console.error(`${failed.length} not recorded, run npm run audio again:\n  ${failed.join('\n  ')}`);
  process.exitCode = 1;
}

function clipName(text) {
  return `clips/${createHash('sha1').update(text).digest('hex').slice(0, 12)}.mp3`;
}

async function say(text, out) {
  // the service sometimes answers "no audio" when called too often: back off and retry
  const delays = [2000, 5000, 10000, 20000];
  for (let attempt = 0; ; attempt++) {
    try {
      await run(EDGE_TTS, ['--voice', VOICE, `--rate=${RATE}`, `--text=${text}`, '--write-media', out]);
      return;
    } catch (e) {
      rmSync(out, { force: true });
      if (attempt >= delays.length) throw new Error(`edge-tts failed for "${text}"`);
      await new Promise((r) => setTimeout(r, delays[attempt]));
    }
  }
}

async function pool(items, size, fn) {
  const queue = items.slice();
  await Promise.all(Array.from({ length: Math.min(size, queue.length) }, async () => {
    while (queue.length) await fn(queue.shift());
  }));
}
