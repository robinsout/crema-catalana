// Content scaffolding (BACKLOG F-4). Files and registrations only; the text is written by hand.
//   npm run new-language -- <code> <name>        a draft language: ui, plan, profile to fill
//   npm run publish-language -- <code>           the draft goes to the language switcher
//   npm run new-lesson -- <id> [--kind topic|overview --title "…" --related b1-01,b1-02]
//   npm run adapt -- <id> <lang> [--restamp]     a lesson for another language (or renew its stamp)
//   npm run register                             new lesson and chapter ids → tests/published-*.json
import { adaptLesson, newLanguage, newLesson, publishLanguage, registerPublished } from './lib/scaffold.ts';
import type { LessonKind } from '../src/types/index.ts';

const [command = '', ...args] = process.argv.slice(2);
const positional = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.match(/^--(kind|title|related)$/));
const option = (name: string): string | undefined => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const today = new Date().toISOString().slice(0, 10);
const root = process.cwd();

function run(): string {
  switch (command) {
    case 'new-language': {
      const [code, name] = positional;
      if (!code || !name) throw new Error('usage: npm run new-language -- <code> <name>');
      const files = newLanguage(root, code, name);
      return `draft language ${code} (${name}):\n  ${files.join('\n  ')}\nnext: fill authoring/profiles/${code}.md, translate ui.json and catalog.json, then npm run adapt -- intro ${code}`;
    }
    case 'publish-language': {
      const [code] = positional;
      if (!code) throw new Error('usage: npm run publish-language -- <code>');
      publishLanguage(root, code);
      return `${code} is in the language switcher now`;
    }
    case 'new-lesson': {
      const [id] = positional;
      if (!id) throw new Error('usage: npm run new-lesson -- <id> [--kind topic|overview --title "…" --related b1-01,b1-02]');
      const kind = option('kind') as LessonKind | undefined;
      const file = newLesson(root, { id, kind, title: option('title'), related: option('related')?.split(',').filter(Boolean), today });
      return `${file}\nnext: write the lesson, plan texts in catalog.json, npm run audio, npm run register, npm run check`;
    }
    case 'adapt': {
      const [id, lang] = positional;
      if (!id || !lang) throw new Error('usage: npm run adapt -- <id> <lang> [--restamp]');
      const restamp = args.includes('--restamp');
      const file = adaptLesson(root, { id, lang, today, restamp });
      return restamp ? `re-stamped ${file}` : `${file}\nnext: rewrite it for the ${lang} reader (authoring/profiles/${lang}.md), translate exercises, vocabulary and plan texts, npm run audio, npm run check`;
    }
    case 'register': {
      const added = registerPublished(root);
      return added.length ? `registered: ${added.join(', ')}` : 'nothing new to register';
    }
    default:
      throw new Error(`unknown command "${command}"`);
  }
}

try {
  console.log(run());
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
