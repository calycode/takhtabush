import type { CreateCardInput, ImportDeckInput, ImportResult } from '@caly/shared';
import { MAX_IMPORT_ROWS, parseImportContent } from '@caly/shared';
import type { AppEnv } from '../env';
import { listCardFronts } from '../repositories/cards';
import { createCard, patchCard } from './card-service';
import { getOwnedDeck } from './deck-service';

const frontKey = (front: string) => front.trim().toLowerCase();

export async function importIntoDeck(
   env: AppEnv,
   userId: string,
   deckId: string,
   input: ImportDeckInput,
): Promise<ImportResult> {
   await getOwnedDeck(env, userId, deckId);
   const parsed = parseImportContent(input.format, input.content, input.hasHeader, {
      delimiter: input.delimiter,
      tagSeparator: input.tagSeparator,
   });
   const errors = [...parsed.errors];
   let imported = 0;
   let updated = 0;
   let skipped = 0;

   // Dedupe by front: an existing card with the same front is updated, not duplicated.
   const existingByFront = new Map<string, string>();
   for (const card of await listCardFronts(env, deckId)) {
      existingByFront.set(frontKey(card.front), card.id);
   }

   for (const [index, row] of parsed.rows.entries()) {
      if (index >= MAX_IMPORT_ROWS) {
         skipped += 1;
         continue;
      }
      const tags = [...(row.tags ?? []), ...input.tags].slice(0, 20);
      const existingId = existingByFront.get(frontKey(row.front));
      try {
         if (existingId) {
            await patchCard(env, userId, existingId, {
               back: row.back ?? null,
               tags,
               status: 'active',
            });
            updated += 1;
         } else {
            const card: CreateCardInput = {
               type: 'term_definition',
               front: row.front,
               back: row.back,
               tags,
               status: 'active',
               source: 'import',
            };
            const created = await createCard(env, userId, deckId, card);
            existingByFront.set(frontKey(row.front), created.id);
            imported += 1;
         }
      } catch (cause) {
         skipped += 1;
         errors.push({
            row: index + 1,
            message: cause instanceof Error ? cause.message : 'Import failed',
         });
      }
   }

   return { imported, updated, skipped, errors };
}
