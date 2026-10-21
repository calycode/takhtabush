import { describe, expect, it } from 'vitest';
import {
   checkAnswer,
   checkCloze,
   extractClozeTokens,
   gradeFromPerformance,
   maskCloze,
   normalizeAnswer,
} from './grading';

describe('grading', () => {
   it('normalizes case, accents, punctuation, and spacing', () => {
      expect(normalizeAnswer('  Café,  Au Lait! ')).toBe('cafe au lait');
   });

   it('checks typed answers leniently', () => {
      expect(checkAnswer('Paris', '  paris ')).toBe(true);
      expect(checkAnswer('Paris', 'london')).toBe(false);
      expect(checkAnswer('', '')).toBe(false);
   });

   it('extracts and masks cloze tokens', () => {
      expect(extractClozeTokens('The {{capital}} of France is {{Paris}}.')).toEqual([
         'capital',
         'Paris',
      ]);
      expect(maskCloze('The capital of France is {{Paris}}.')).toBe(
         'The capital of France is _____.',
      );
   });

   it('checks cloze answers', () => {
      expect(checkCloze('The capital is {{Paris}}.', 'paris')).toBe(true);
      expect(checkCloze('The capital is {{Paris}}.', 'london')).toBe(false);
      expect(checkCloze('no blanks here', 'x')).toBe(false);
   });

   it('derives all four grades from performance', () => {
      const base = { correct: true, durationMs: 6000, attempts: 1 };
      expect(gradeFromPerformance({ ...base, correct: false })).toBe('again');
      expect(gradeFromPerformance({ ...base, attempts: 2 })).toBe('hard');
      expect(gradeFromPerformance({ ...base, durationMs: 1000 })).toBe('easy');
      expect(gradeFromPerformance({ ...base, durationMs: 20000 })).toBe('hard');
      expect(gradeFromPerformance(base)).toBe('good');
   });
});
