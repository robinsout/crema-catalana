import type { TenseId } from '../types/index.ts';
import { useI18n } from './useI18n.ts';

// What each tense is for, in the reader's language (the Catalan name is shown next to it)
export function useTenseNames() {
  const { t } = useI18n();
  return (id: TenseId): string => ({
    'ind.pres': t('tense.indPres'),
    'ind.perf': t('tense.indPerf'),
    'ind.perif': t('tense.indPerif'),
    'ind.imperf': t('tense.indImperf'),
    'ind.plusq': t('tense.indPlusq'),
    'ind.fut': t('tense.indFut'),
    'ind.futPerf': t('tense.indFutPerf'),
    'ind.cond': t('tense.indCond'),
    'ind.condPerf': t('tense.indCondPerf'),
    'ind.simple': t('tense.indSimple'),
    'ind.ant': t('tense.indAnt'),
    'ind.antPerif': t('tense.indAntPerif'),
    'subj.pres': t('tense.subjPres'),
    'subj.perf': t('tense.subjPerf'),
    'subj.imperf': t('tense.subjImperf'),
    'subj.plusq': t('tense.subjPlusq'),
    'subj.perif': t('tense.subjPerif'),
    imp: t('tense.imp'),
    nonpers: t('tense.nonpers'),
  } satisfies Record<TenseId, string>)[id];
}
