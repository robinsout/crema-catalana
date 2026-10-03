// Progress saved in the viewer's browser.
//
// Compatibility contract: the key and the { done: {id: bool}, last: id } shape never change.
// New data goes into new fields; unknown fields are kept on save. A renamed lesson id is
// added to ID_ALIASES, and old saved data is migrated when it is read.
//
// Versions of the saved data:
//   v1, v2  { done, last }
//   v3      + doneAt: { id: ms timestamp of the last change of done[id] } — used to merge devices

export const STORAGE_KEY = 'quadern-catala';

export const ID_ALIASES = {
  l01: 'intro', // v1: the intro lesson was "l01"
};

export const canonicalId = (id) => (typeof id === 'string' && ID_ALIASES[id]) || id;

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Reads an { id: value } map, migrating old ids. Entries under old ids go first,
// so a value stored under the current id wins.
function readIdMap(map, accept) {
  const out = {};
  if (!isObject(map)) return out;
  const entries = Object.entries(map).sort(([a], [b]) => (b in ID_ALIASES) - (a in ID_ALIASES));
  for (const [id, value] of entries) {
    const v = accept(value);
    if (v !== undefined) out[canonicalId(id)] = v;
  }
  return out;
}

export function parseProgress(raw) {
  let data = null;
  try { data = JSON.parse(raw); } catch (e) { data = null; }
  if (!isObject(data)) data = {};

  const done = readIdMap(data.done, (v) => v === true);
  const doneAt = readIdMap(data.doneAt, (v) => (Number.isFinite(v) ? v : undefined));
  const last = typeof data.last === 'string' && data.last ? canonicalId(data.last) : null;
  return { ...data, done, doneAt, last };
}

export function serializeProgress(state) {
  return JSON.stringify(state);
}

// Merges progress from another device into the local one. For each lesson the later change
// wins; a mark without a timestamp (saved before v3) counts as the oldest; on a tie "done" wins.
// `last` and any other fields stay local: they describe this device.
export function mergeProgress(local, remote) {
  const ld = (local && local.done) || {};
  const rd = (remote && remote.done) || {};
  const lt = (local && local.doneAt) || {};
  const rt = (remote && remote.doneAt) || {};
  const done = {};
  const doneAt = {};
  for (const id of new Set([...Object.keys(ld), ...Object.keys(rd)])) {
    const a = { done: ld[id] === true, at: lt[id] ?? -1, has: id in ld };
    const b = { done: rd[id] === true, at: rt[id] ?? -1, has: id in rd };
    const win = !b.has ? a : !a.has ? b
      : a.at > b.at ? a : b.at > a.at ? b
      : (a.done ? a : b);
    done[id] = win.done;
    if (win.at >= 0) doneAt[id] = win.at;
  }
  return { ...local, done, doneAt };
}

export function createStore(backend, { now = () => Date.now() } = {}) {
  let raw = null;
  try { raw = backend ? backend.getItem(STORAGE_KEY) : null; } catch (e) { raw = null; }
  const state = parseProgress(raw);

  const save = () => {
    try { if (backend) backend.setItem(STORAGE_KEY, serializeProgress(state)); } catch (e) { /* storage unavailable */ }
  };
  const mark = (id, value) => {
    state.done[id] = value === true;
    state.doneAt[id] = now();
    save();
    return state.done[id];
  };

  return {
    state,
    setDone(id, value) { mark(id, value); },
    toggleDone(id) { return mark(id, !state.done[id]); },
    setLast(id) { state.last = id; save(); },
  };
}
