// Data contracts of the course: files in content/ and the progress saved in the browser.

export type LessonKind = 'topic' | 'overview';

export interface CourseInfo {
  title?: string;
  publisher?: string;
  level?: string;
}

// content/course.json — structure, the same for every language
export interface UnitDef {
  id: string;
  unit: number;
  title: string; // Catalan
  hasVocab?: boolean; // has content/vocab/<id>.json
}

export interface ExtraDef {
  id: string;
  kind: LessonKind;
  title: string; // Catalan
  related?: string[]; // unit ids
  hasVocab?: boolean; // has content/vocab/<id>.json
}

export interface PartDef {
  id: string;
  title: string;
  units: UnitDef[];
}

export interface Course {
  course: CourseInfo;
  extras: ExtraDef[];
  parts: PartDef[];
}

// content/locales/<lang>/catalog.json — texts in the reader's language
export interface LessonTexts {
  subtitle?: string;
  topic?: string;
  grammar?: string[];
  vocab?: string;
  extra?: string;
  mission?: string;
  date?: string; // the lesson is written in this language
}

export interface PartTexts {
  period?: string;
  focus?: string;
}

export interface LocaleCatalog {
  course?: Partial<CourseInfo>;
  parts?: Record<string, PartTexts>;
  lessons?: Record<string, LessonTexts>;
}

// content/locales/index.json
export interface LocalesIndex {
  base: string;
  default: string;
  available: string[];
  names?: Record<string, string>; // each language by its own name: "Русский", "English"
}

// Merged catalog of one language
export interface LessonData extends LessonTexts {
  id: string;
  title: string;
  hasVocab?: boolean;
  kind?: LessonKind;
  unit?: number;
  related?: string[];
  file?: string;
}

export interface Part extends PartTexts {
  id: string;
  title: string;
  units: LessonData[];
}

export interface Catalog {
  course: CourseInfo;
  extras: LessonData[];
  parts: Part[];
}

export type ExtraLesson = LessonData & { track: 'extra'; part?: undefined };
export type UnitLesson = LessonData & { track: 'unit'; part: Part };
export type Lesson = ExtraLesson | UnitLesson;

// Interface strings: content/locales/<lang>/ui.json
export type UiStrings = Record<string, string>;
export type Translate = (key: string, vars?: object) => string;

// content/audio/index.json — shared pronunciation clips
export interface AudioIndex {
  voice?: string;
  rate?: string;
  clips: Record<string, string>; // normalized Catalan phrase → clips/<hash>.mp3
}

// Where progress is persisted (localStorage in the browser, a fake in tests)
export type StorageBackend = Pick<Storage, 'getItem' | 'setItem'>;

// Lesson vocabulary: Catalan words (content/vocab/<lesson>.json, the same for every language)
export type Gender = 'm' | 'f' | 'mf';

export interface VocabWordDef {
  id: string;
  ca: string; // with the article when it helps: "la tardor", "l'estiu"
  gender?: Gender;
  plural?: string;
}

export interface VocabSource {
  groups: { id: string; words: VocabWordDef[] }[];
}

// ...and their translation (content/locales/<lang>/vocab/<lesson>.json)
export interface LocaleVocab {
  groups: Record<string, string>; // group id → title
  words: Record<string, { tr: string; note?: string }>;
}

// merged, for the page
export interface VocabWord extends VocabWordDef {
  tr: string;
  note?: string;
}

export interface VocabGroup {
  id: string;
  title: string;
  words: VocabWord[];
}

// Interactive exercises of a lesson: content/locales/<lang>/exercises/<lesson>.json,
// placed in the lesson HTML with <div data-exercise="<id>"></div>
export interface FillItem {
  prompt: string; // HTML; Catalan inside <span lang="ca">
  answers: string[]; // accepted answers in Catalan; the first is shown as the solution
  hint?: string;
}

export interface ChoiceItem {
  prompt: string;
  options: string[];
  answer: number; // index of the right option
  explain?: string;
}

export type Exercise =
  | { type: 'fill'; title?: string; items: FillItem[] }
  | { type: 'choice'; title?: string; items: ChoiceItem[] };

export type ExerciseSet = Record<string, Exercise>;

export type AnswerCheck = 'correct' | 'accent' | 'wrong' | 'empty';

// The latest result of an exercise, saved in progress (key "<lesson id>/<exercise id>")
export interface ExerciseResult {
  score: number;
  total: number;
  at: number; // ms timestamp
}

// A chapter (<section id>) of a lesson marked as studied by hand, and when the mark last changed.
export interface SectionMark {
  done: boolean;
  at: number; // ms timestamp
}

// The furthest chapter of a lesson the reader got to, and when.
export interface ReadingPoint {
  section: string;
  at: number; // ms timestamp
}
