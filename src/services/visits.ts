// What the site may tell the visit counter: these events with these fields, each value checked here
// (the counter checks them again against projects.json of robinsout/counter). Anything that does not fit
// is dropped, so a route parameter or a code can never go out by mistake.
import { visitsApi } from '../api/visits.ts';
import { isLessonId } from './progress.ts';

const SCHEMA = {
  view: { page: 'id', lang: 'lang' },
  chapter: { lesson: 'id', chapter: 'id', lang: 'lang' },
  exercise: { lesson: 'id', exercise: 'id', score: 'int', total: 'int', lang: 'lang' },
  audio: { lesson: 'id', lang: 'lang' },
  sync: { lang: 'lang' },
} as const;

export type VisitEventName = keyof typeof SCHEMA;
export type VisitProps = Record<string, string | number>;

const valid: Record<string, (v: unknown) => boolean> = {
  id: (v) => typeof v === 'string' && v.length <= 48 && isLessonId(v),
  lang: (v) => typeof v === 'string' && /^[a-z]{2,3}$/.test(v),
  int: (v) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 100_000,
};

export function visitEvent(event: VisitEventName, props: Record<string, unknown>): { event: VisitEventName; props: VisitProps } | null {
  const fields: Record<string, string> = SCHEMA[event];
  const out: VisitProps = {};
  for (const [name, type] of Object.entries(fields)) {
    const v = props[name];
    if (!valid[type]?.(v)) return null;
    out[name] = v as string | number;
  }
  return { event, props: out };
}

// sends the event when it fits the schema; false when it was dropped
export function countVisit(event: VisitEventName, props: Record<string, unknown>): boolean {
  const e = visitEvent(event, props);
  if (e) visitsApi.count(e.event, e.props);
  return e !== null;
}

export const visitsOff = (): boolean => visitsApi.isOff();
export const setVisitsOff = (off: boolean): void => visitsApi.setOff(off);
