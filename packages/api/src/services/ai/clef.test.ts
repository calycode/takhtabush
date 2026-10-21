import { describe, expect, it } from 'vitest';
import { parseClefEvaluation, parseClefStrategy } from './clef';

describe('clef response parsing', () => {
   it('extracts a valid evaluation from noisy text', () => {
      const text =
         'Here you go:\n{"clarity":4,"difficulty":3,"duplicateLikelihood":0.1,"subject":"language"}';
      const result = parseClefEvaluation(text);
      expect(result).toEqual({
         clarity: 4,
         difficulty: 3,
         duplicateLikelihood: 0.1,
         subject: 'language',
      });
   });

   it('coerces numeric strings', () => {
      const result = parseClefEvaluation(
         '{"clarity":"4","difficulty":"3","duplicateLikelihood":0.5,"subject":"other"}',
      );
      expect(result?.clarity).toBe(4);
      expect(result?.difficulty).toBe(3);
   });

   it('rejects invalid or out-of-range output', () => {
      expect(parseClefEvaluation('{"clarity":9}')).toBeNull();
      expect(parseClefEvaluation('not json at all')).toBeNull();
      expect(
         parseClefEvaluation('{"clarity":3,"difficulty":3,"duplicateLikelihood":2,"subject":"x"}'),
      ).toBeNull();
   });

   it('accepts only allowed strategies', () => {
      expect(parseClefStrategy('{"strategy":"consolidate"}', ['consolidate', 'mixed'])).toBe(
         'consolidate',
      );
      expect(parseClefStrategy('{"strategy":"destroy"}', ['consolidate', 'mixed'])).toBeNull();
      expect(parseClefStrategy('garbage', ['consolidate'])).toBeNull();
   });
});
