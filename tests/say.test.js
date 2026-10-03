import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSayText, ttsText, clipFor } from '../portal/js/say.js';
import { extractSayTexts } from '../scripts/lib/say-texts.mjs';

test('normalizeSayText collapses whitespace and trims', () => {
  assert.equal(normalizeSayText('  Bon\n   dia! '), 'Bon dia!');
  assert.equal(normalizeSayText(''), '');
  assert.equal(normalizeSayText(null), '');
});

test('ttsText drops syllable dots but keeps the ela geminada', () => {
  assert.equal(ttsText('ca·sa'), 'casa');
  assert.equal(ttsText('a·ni·mal'), 'animal');
  assert.equal(ttsText('col·legi'), 'col·legi');
});

test('ttsText drops the dash of suffix markers', () => {
  assert.equal(ttsText('-gut'), 'gut');
  assert.equal(ttsText('-car'), 'car');
  assert.equal(ttsText('vint-i-u'), 'vint-i-u');
});

test('clipFor finds a clip by normalized text', () => {
  const manifest = { voice: 'x', clips: { 'Bon dia!': 'a1.mp3' } };
  assert.equal(clipFor(manifest, ' Bon\n dia! '), 'a1.mp3');
  assert.equal(clipFor(manifest, 'Adéu'), null);
  assert.equal(clipFor(null, 'Bon dia!'), null);
});

test('extracts text of every speakable element, like the page does on click', () => {
  const html = `
    <p>Пример: <span lang="ca">c<b>a</b>sa</span> и <span class="ipa">[ˈkazə]</span></p>
    <table><tr><td lang="ca">ca<b>s</b>a, ro<b>s</b>a</td><td>рус. «з»</td></tr></table>
    <table class="conj" lang="ca"><thead><tr><th>jo</th></tr></thead>
      <tbody><tr><th>jo</th><td>parl<b>o</b></td><td>perd<b>o</b></td></tr></tbody></table>
    <ol><li lang="ca">canto, cantes</li><li>не каталанский</li></ol>
    <blockquote class="reading" lang="ca">Bon dia!
      Em dic Àlex.</blockquote>
    <p>Amp: <span lang="ca">l&#39;home &amp; d'olla</span></p>`;
  assert.deepEqual(extractSayTexts(html), [
    'casa', 'casa, rosa', 'parlo', 'perdo', 'canto, cantes', 'Bon dia! Em dic Àlex.', "l'home & d'olla",
  ]);
});

test('extraction removes duplicates and empty elements', () => {
  const html = '<span lang="ca">sí</span><span lang="ca">sí</span><span lang="ca"> </span>';
  assert.deepEqual(extractSayTexts(html), ['sí']);
});
