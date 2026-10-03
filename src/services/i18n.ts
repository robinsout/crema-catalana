// Interface strings. Each language has locales/<lang>/ui.json: { "key": "text with {placeholders}" }.
// Keys starting with "_" are settings (e.g. "_dateLocale"), not strings.
import type { Translate, UiStrings } from '../types/index.ts';

export function createT(strings: UiStrings | null | undefined): Translate {
  const dict = strings || {};
  return (key, vars) => {
    const s = Object.prototype.hasOwnProperty.call(dict, key) ? (dict[key] as string) : key;
    if (!vars) return s;
    const values = vars as Record<string, unknown>;
    return s.replace(/\{(\w+)\}/g, (m, name: string) => (name in values ? String(values[name]) : m));
  };
}
