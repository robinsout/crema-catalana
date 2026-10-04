// What the browser says about the reader: the preferred languages, most preferred first.
export function browserLanguages(): readonly string[] {
  try { return globalThis.navigator?.languages ?? []; } catch { return []; }
}
