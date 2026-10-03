// Records pronunciation clips for every Catalan phrase in the lessons and the study plan.
// Uses edge-tts (Microsoft neural voices): pip install edge-tts, or set EDGE_TTS=/path/to/edge-tts.
// Only new phrases are recorded; clips for phrases that disappeared are deleted.
// Runs locally only; the clips are committed, CI just checks they are complete.
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { normalizeCatalog, allLessons, PLAN_ID } from '../portal/js/model.js';
import { normalizeSayText, ttsText } from '../portal/js/say.js';
import { extractSayTexts } from './lib/say-texts.mjs';

const run = promisify(execFile);
const VOICE = 'ca-ES-JoanaNeural';
const RATE = '-10%';
const EDGE_TTS = process.env.EDGE_TTS || 'edge-tts';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const portal = join(root, 'portal');
const audioDir = join(portal, 'audio');

const catalog = normalizeCatalog(JSON.parse(readFileSync(join(portal, 'lessons.json'), 'utf8')));
const jobs = allLessons(catalog)
  .filter((l) => l.file)
  .map((l) => ({ id: l.id, texts: extractSayTexts(readFileSync(join(portal, l.file), 'utf8')) }));
jobs.push({ id: PLAN_ID, texts: [...new Set(allLessons(catalog).map((l) => normalizeSayText(l.title)))] });

const only = process.argv[2];
for (const job of jobs) {
  if (!only || only === job.id) await record(job);
}

async function record({ id, texts }) {
  const manifestPath = join(audioDir, `${id}.json`);
  const old = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { clips: {} };
  const reuse = old.voice === VOICE && old.rate === RATE ? old.clips : {};
  const clips = {};
  const todo = [];
  const sameVoice = old.voice === undefined || reuse === old.clips;
  for (const t of texts) {
    const file = clipName(id, t);
    if (reuse[t] && existsSync(join(audioDir, reuse[t]))) clips[t] = reuse[t];
    else if (sameVoice && existsSync(join(audioDir, file))) clips[t] = file; // recorded by an interrupted run
    else todo.push(t);
  }
  mkdirSync(join(audioDir, id), { recursive: true });
  let done = 0;
  const failed = [];
  await pool(todo, 2, async (t) => {
    const file = clipName(id, t);
    try {
      await say(ttsText(t), join(audioDir, file));
      clips[t] = file;
    } catch (e) {
      failed.push(t);
    }
    process.stdout.write(`\r${id}: ${++done}/${todo.length} new clips`);
  });
  if (todo.length) process.stdout.write('\n');

  const keep = new Set(Object.values(clips));
  for (const file of Object.values(old.clips || {})) {
    if (!keep.has(file)) rmSync(join(audioDir, file), { force: true });
  }
  const sorted = Object.fromEntries(texts.filter((t) => clips[t]).map((t) => [t, clips[t]]));
  writeFileSync(manifestPath, JSON.stringify({ voice: VOICE, rate: RATE, clips: sorted }, null, 1) + '\n');
  console.log(`${id}: ${texts.length} phrases, ${todo.length - failed.length} recorded`);
  if (failed.length) {
    console.error(`${id}: ${failed.length} not recorded, run npm run audio again:\n  ${failed.join('\n  ')}`);
    process.exitCode = 1;
  }
}

function clipName(id, text) {
  return `${id}/${createHash('sha1').update(text).digest('hex').slice(0, 12)}.mp3`;
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
