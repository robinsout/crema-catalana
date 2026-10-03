// Progress saved in the viewer's browser.
//
// Compatibility contract: the key and the { done: {id: bool}, last: id } shape never change.
// New data goes into new fields; unknown fields are kept on save. A renamed lesson id is
// added to ID_ALIASES, and old saved data is migrated when it is read.

export const STORAGE_KEY = 'quadern-catala';

export const ID_ALIASES = {
  l01: 'intro', // v1: the intro lesson was "l01"
};

export const canonicalId = (id) => (typeof id === 'string' && ID_ALIASES[id]) || id;

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export function parseProgress(raw) {
  let data = null;
  try { data = JSON.parse(raw); } catch (e) { data = null; }
  if (!isObject(data)) data = {};

  const done = {};
  if (isObject(data.done)) {
    // aliased (old) ids first, so a mark stored under the current id wins
    const entries = Object.entries(data.done).sort(([a], [b]) => (b in ID_ALIASES) - (a in ID_ALIASES));
    for (const [id, value] of entries) done[canonicalId(id)] = value === true;
  }
  const last = typeof data.last === 'string' && data.last ? canonicalId(data.last) : null;
  return { ...data, done, last };
}

export function serializeProgress(state) {
  return JSON.stringify(state);
}

export function createStore(backend) {
  let raw = null;
  try { raw = backend ? backend.getItem(STORAGE_KEY) : null; } catch (e) { raw = null; }
  const state = parseProgress(raw);

  const save = () => {
    try { if (backend) backend.setItem(STORAGE_KEY, serializeProgress(state)); } catch (e) { /* storage unavailable */ }
  };

  return {
    state,
    setDone(id, value) { state.done[id] = value === true; save(); },
    toggleDone(id) { state.done[id] = !state.done[id]; save(); return state.done[id]; },
    setLast(id) { state.last = id; save(); },
  };
}
