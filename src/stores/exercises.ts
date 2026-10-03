// Interactive exercises: checking answers and keeping the latest results in progress.
import { defineStore } from 'pinia';
import { checkAnswer, scoreOf } from '../services/exercises.ts';
import { useProgressStore } from './progress.ts';
import type { AnswerCheck, ChoiceItem, ExerciseResult, FillItem } from '../types/index.ts';

export const useExercisesStore = defineStore('exercises', () => {
  const progress = useProgressStore();

  const result = (key: string): ExerciseResult | null => progress.result(key);

  // checks every answer of a fill-in exercise and saves the score
  function checkFill(key: string, items: FillItem[], answers: string[]): { checks: AnswerCheck[]; score: number; total: number } {
    const checks = items.map((item, i) => checkAnswer(answers[i] ?? '', item.answers));
    const { score, total } = scoreOf(checks);
    progress.saveResult(key, score, total);
    return { checks, score, total };
  }

  const isRight = (item: ChoiceItem, option: number): boolean => item.answer === option;

  // saves the score once every item of a choice exercise is answered
  function finishChoice(key: string, items: ChoiceItem[], picked: number[]): { score: number; total: number } {
    const score = picked.filter((p, i) => items[i] !== undefined && isRight(items[i], p)).length;
    progress.saveResult(key, score, items.length);
    return { score, total: items.length };
  }

  return { result, checkFill, isRight, finishChoice };
});
