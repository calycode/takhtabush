import type { ImportResult } from '@caly/shared';
import { MAX_CARDS_PER_DECK, MAX_IMPORT_BYTES } from '@caly/shared/limits';
import type { Connection } from './connection';
import { AppError } from './errors';
import type { CloneResult, CloneSetPayload } from './messages';
import { createDeck, importDeck } from './mcp';

export async function cloneSet(
   connection: Connection,
   payload: CloneSetPayload,
): Promise<CloneResult> {
   const cards = payload.cards
      .map((card) => ({ front: card.term.trim(), back: card.definition.trim() }))
      .filter((card) => card.front.length > 0);

   if (cards.length === 0) {
      throw new AppError('NO_CARDS', 'No term/definition pairs were found on this page.');
   }
   if (cards.length > MAX_CARDS_PER_DECK) {
      throw new AppError(
         'TOO_MANY_CARDS',
         `This set has ${cards.length} cards, but a Takhtabush deck holds at most ${MAX_CARDS_PER_DECK}.`,
      );
   }

   const content = JSON.stringify(cards);
   if (content.length > MAX_IMPORT_BYTES) {
      throw new AppError(
         'IMPORT_TOO_LARGE',
         'This set is too large to import in one request. Try a smaller set.',
      );
   }

   const title = (payload.title.trim() || 'Quizlet set').slice(0, 200);
   const description = [payload.description.trim(), `Imported from Quizlet: ${payload.sourceUrl}`]
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 2000);

   const deck = await createDeck(connection, {
      title,
      ...(description ? { description } : {}),
   });

   let result: ImportResult;
   try {
      result = await importDeck(connection, deck.id, content);
   } catch (cause) {
      if (cause instanceof AppError) {
         throw new AppError(
            cause.code,
            `${cause.message} The deck "${deck.title}" was created; open ${connection.origin}/decks/${deck.id} to inspect it.`,
         );
      }
      throw cause;
   }

   return {
      deckId: deck.id,
      deckTitle: deck.title,
      imported: result.imported,
      updated: result.updated,
      skipped: result.skipped,
      origin: connection.origin,
   };
}
