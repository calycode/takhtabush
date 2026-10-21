import { describe, expect, it } from 'vitest';
import type { StudyCardData } from './study-card';
import { cardAnswer, choiceOptionsFor, seededShuffle } from './study-card';

function card(overrides: Partial<StudyCardData> = {}): StudyCardData {
   return {
      id: 'card_1',
      type: 'term_definition',
      front: 'hola',
      back: 'hello',
      clozeText: null,
      choices: null,
      correctChoice: null,
      imageUrl: null,
      audioUrl: null,
      ...overrides,
   };
}

describe('shared study card helpers', () => {
   it('uses authored choices as the answer and option set', () => {
      const item = card({
         choices: ['hello', 'goodbye'],
         correctChoice: 1,
      });

      expect(cardAnswer(item)).toBe('goodbye');
      expect(choiceOptionsFor(item, [])).toEqual(['hello', 'goodbye']);
   });

   it('builds distractors from the session pool when a card has no choices', () => {
      const pool = [
         card(),
         card({ id: 'card_2', front: 'adios', back: 'goodbye' }),
         card({ id: 'card_3', front: 'gracias', back: 'thanks' }),
         card({ id: 'card_4', front: 'por favor', back: 'please' }),
         card({ id: 'card_5', front: 'si', back: 'yes' }),
      ];

      const options = choiceOptionsFor(pool[0], pool);

      expect(options).toContain('hello');
      expect(new Set(options).size).toBe(options.length);
      expect(options.length).toBe(4);
      expect(options).toEqual(choiceOptionsFor(pool[0], pool));
   });

   it('keeps the shuffle deterministic for a seed', () => {
      const items = ['a', 'b', 'c', 'd', 'e'];

      expect(seededShuffle(items, 'seed')).toEqual(seededShuffle(items, 'seed'));
      expect(seededShuffle(items, 'seed')).not.toEqual(items);
   });
});
