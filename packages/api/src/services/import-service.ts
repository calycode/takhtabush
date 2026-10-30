import type { CreateCardInput, ImportDeckInput, ImportResult } from '@caly/shared';
import {
   LIMIT_ERROR_CODES,
   MAX_CARDS_PER_DECK,
   MAX_IMPORT_ROWS,
   MAX_TAGS_PER_CARD,
   parseImportContent,
} from '@caly/shared';
import { newId } from '@caly/worker-kit';
import type { AppEnv } from '../env';
import { limitExceeded } from '../lib/errors';
import {
   getCardRowsByIds,
   insertCardRowsRaw,
   listCardFronts,
   updateCardRows,
} from '../repositories/cards';
import { releaseCardSlots, reserveCardSlots } from '../repositories/decks';
import { getOwnedDeck } from './deck-service';

const frontKey = (front: string) => front.trim().toLowerCase();

/**
 * Import is deliberately batched: one read for existing fronts, one batched
 * read for the rows it updates, one slot reservation, then `db.batch()` writes.
 * Statement count grows with batches, never with rows, and a deck that would
 * exceed the cap rejects the whole import before anything is written.
 */
export async function importIntoDeck(
   env: AppEnv,
   userId: string,
   deckId: string,
   input: ImportDeckInput,
): Promise<ImportResult> {
   const deck = await getOwnedDeck(env, userId, deckId);
   const parsed = parseImportContent(input.format, input.content, input.hasHeader, {
      delimiter: input.delimiter,
      tagSeparator: input.tagSeparator,
   });

   const rows = parsed.rows.slice(0, MAX_IMPORT_ROWS);
   const overflow = parsed.rows.length - rows.length;

   const existingByFront = new Map<string, string>();
   for (const card of await listCardFronts(env, deckId)) {
      existingByFront.set(frontKey(card.front), card.id);
   }

   // Dedupe within the file (last row wins), matching the old behaviour where a
   // repeated front updated the card created by the previous row.
   const creates = new Map<string, CreateCardInput>();
   const updates = new Map<string, CreateCardInput>();
   for (const row of rows) {
      const key = frontKey(row.front);
      const tags = [...(row.tags ?? []), ...input.tags].slice(0, MAX_TAGS_PER_CARD);
      const card: CreateCardInput = {
         type: 'term_definition',
         front: row.front,
         back: row.back,
         tags,
         status: 'active',
         source: 'import',
      };
      const existingId = existingByFront.get(key);
      if (existingId) {
         updates.set(existingId, card);
         creates.delete(key);
      } else {
         creates.set(key, card);
      }
   }

   const newCount = creates.size;
   if (deck.cardCount + newCount > MAX_CARDS_PER_DECK) {
      throw limitExceeded(
         LIMIT_ERROR_CODES.cardsPerDeck,
         `A deck can hold at most ${MAX_CARDS_PER_DECK} cards.`,
         {
            limit: MAX_CARDS_PER_DECK,
            current: deck.cardCount,
            requested: newCount,
            deckId,
         },
      );
   }

   const reserved = await reserveCardSlots(env, deckId, newCount, MAX_CARDS_PER_DECK);
   if (!reserved) {
      throw limitExceeded(
         LIMIT_ERROR_CODES.cardsPerDeck,
         `A deck can hold at most ${MAX_CARDS_PER_DECK} cards.`,
         { limit: MAX_CARDS_PER_DECK, current: deck.cardCount, requested: newCount, deckId },
      );
   }

   try {
      if (newCount > 0) {
         await insertCardRowsRaw(
            env,
            [...creates.values()].map((card) => ({
               id: newId('card'),
               deckId,
               ownerId: userId,
               card,
            })),
         );
      }

      if (updates.size > 0) {
         const ids = [...updates.keys()];
         const existingRows = await getCardRowsByIds(env, userId, ids);
         const snapshots = new Map(existingRows.map((row) => [String(row.id), row]));
         const patches = ids.map((cardId) => {
            const patch = updates.get(cardId)!;
            return {
               cardId,
               ownerId: userId,
               deckId,
               authorId: userId,
               snapshot: snapshots.get(cardId) ?? {},
               patch: { back: patch.back ?? null, tags: patch.tags, status: 'active' as const },
            };
         });
         await updateCardRows(env, patches);
      }
   } catch (cause) {
      await releaseCardSlots(env, deckId, newCount);
      throw cause;
   }

   return {
      imported: newCount,
      updated: updates.size,
      skipped: overflow,
      errors: parsed.errors,
   };
}
