import { describe, expect, it } from 'vitest';
import { createCardInputSchema, importDeckInputSchema, tagSchema } from './cards';
import { createCollectionInputSchema, updateCollectionInputSchema } from './collections';
import { createDeckInputSchema, listDecksQuerySchema } from './decks';
import {
   LIMITS,
   MAX_CARDS_PER_BULK_CREATE,
   MAX_CARDS_PER_DECK,
   MAX_COLLECTION_NAME_LENGTH,
   MAX_IMPORT_BYTES,
   MAX_TAGS_PER_CARD,
   remainingDeckCapacity,
} from '../domain/limits';
import { mcpCreateCardsInputSchema } from './mcp';

const term = { type: 'term_definition' as const, front: 'front', back: 'back' };

describe('bounded-work limits', () => {
   it('caps a deck at 500 cards', () => {
      expect(MAX_CARDS_PER_DECK).toBe(500);
      expect(remainingDeckCapacity(0)).toBe(500);
      expect(remainingDeckCapacity(499)).toBe(1);
      expect(remainingDeckCapacity(500)).toBe(0);
      expect(remainingDeckCapacity(900)).toBe(0);
   });

   it('rejects a card with more tags than the limit', () => {
      const tags = Array.from({ length: MAX_TAGS_PER_CARD }, (_, index) => `tag-${index}`);
      expect(createCardInputSchema.safeParse({ ...term, tags }).success).toBe(true);
      expect(
         createCardInputSchema.safeParse({ ...term, tags: [...tags, 'one-too-many'] }).success,
      ).toBe(false);
      expect(tagSchema.safeParse('x'.repeat(LIMITS.tagLength)).success).toBe(true);
      expect(tagSchema.safeParse('x'.repeat(LIMITS.tagLength + 1)).success).toBe(false);
   });

   it('caps a bulk create at the shared constant', () => {
      const cards = Array.from({ length: MAX_CARDS_PER_BULK_CREATE + 1 }, () => term);
      expect(
         mcpCreateCardsInputSchema.safeParse({ deckId: 'deck_1', cards: cards.slice(1) }).success,
      ).toBe(true);
      expect(mcpCreateCardsInputSchema.safeParse({ deckId: 'deck_1', cards }).success).toBe(false);
   });

   it('bounds import content by bytes and row count', () => {
      expect(
         importDeckInputSchema.safeParse({
            format: 'csv',
            content: 'a,b',
         }).success,
      ).toBe(true);
      expect(
         importDeckInputSchema.safeParse({
            format: 'csv',
            content: 'x'.repeat(MAX_IMPORT_BYTES + 1),
         }).success,
      ).toBe(false);
      expect(LIMITS.importRows).toBeLessThanOrEqual(MAX_CARDS_PER_DECK);
   });

   it('validates collection names and deck filters', () => {
      expect(createCollectionInputSchema.safeParse({ name: '  Spanish  ' }).success).toBe(true);
      expect(createCollectionInputSchema.safeParse({ name: '   ' }).success).toBe(false);
      expect(
         createCollectionInputSchema.safeParse({ name: 'x'.repeat(MAX_COLLECTION_NAME_LENGTH + 1) })
            .success,
      ).toBe(false);
      expect(updateCollectionInputSchema.safeParse({ position: 3 }).success).toBe(true);
      expect(
         createDeckInputSchema.safeParse({ title: 'Deck', collectionId: 'col_1' }).success,
      ).toBe(true);
      expect(listDecksQuerySchema.parse({ unfiled: 'true' }).unfiled).toBe('true');
      expect(listDecksQuerySchema.safeParse({ unfiled: 'yes' }).success).toBe(false);
   });
});
