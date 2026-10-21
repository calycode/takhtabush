import { describe, expect, it } from 'vitest';
import { createCardInputSchema } from './cards';
import { cursorQuerySchema } from './common';
import { mcpGetStudyPlanInputSchema } from './mcp';
import { createJourneyPlan } from '../domain/journey';

describe('shared contracts', () => {
   it('accepts a valid term_definition card', () => {
      const card = createCardInputSchema.parse({ type: 'term_definition', front: 'a', back: 'b' });
      expect(card.tags).toEqual([]);
      expect(card.status).toBe('active');
   });

   it('requires type-specific fields', () => {
      expect(createCardInputSchema.safeParse({ type: 'cloze', front: 'a' }).success).toBe(false);
      expect(
         createCardInputSchema.safeParse({ type: 'multiple_choice', front: 'a', choices: ['x'] })
            .success,
      ).toBe(false);
   });

   it('defaults pagination to 20 and caps at 50', () => {
      expect(cursorQuerySchema.parse({}).limit).toBe(20);
      expect(cursorQuerySchema.safeParse({ limit: 51 }).success).toBe(false);
   });

   it('lets MCP study plans choose a mode and the cram goal', () => {
      const input = mcpGetStudyPlanInputSchema.parse({
         deckId: 'deck_1',
         mode: 'matching',
         goal: 'cram',
      });

      expect(input.mode).toBe('matching');
      expect(input.goal).toBe('cram');
      expect(input.minutes).toBe(15);
   });

   it('plans a study journey deterministically', () => {
      const plan = createJourneyPlan({
         sessionId: 'stu_1',
         mode: 'mixed',
         goal: 'review',
         minutes: 15,
         dueCardIds: ['card_1', 'card_2'],
         weakCardIds: ['card_3'],
         newCardIds: ['card_4'],
      });
      expect(plan.strategy).toBe('consolidate');
      expect(plan.cardIds[0]).toBe('card_1');
      expect(plan.fallbackUsed).toBe(false);
   });
});
