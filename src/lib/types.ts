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
}

export interface ExtraDef {
  id: string;
  kind: LessonKind;
  title: string; // Catalan
  related?: string[]; // unit ids
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
}

// Merged catalog of one language
export interface LessonData extends LessonTexts {
  id: string;
  title: string;
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
