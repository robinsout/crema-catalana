// Interface strings. Each language has locales/<lang>/ui.json: { "key": "text with {placeholders}" }.
// Keys starting with "_" are settings (e.g. "_dateLocale"), not strings.

export function createT(strings) {
  const dict = strings || {};
  return (key, vars) => {
    const s = Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : key;
    if (!vars) return s;
    return s.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m));
  };
}
