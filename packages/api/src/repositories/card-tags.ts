import type { AppEnv } from '../env';
import { chunk, placeholders } from '../lib/d1';

/** D1 bound-parameter ceiling is 100; four columns per tag row. */
const TAGS_PER_INSERT_STATEMENT = 24;
const CARD_IDS_PER_DELETE = 90;

type Statement = ReturnType<D1Database['prepare']>;

export type CardTagInput = {
   cardId: string;
   ownerId: string;
   deckId: string;
   tags: readonly string[];
};

/** Trim, drop empties, and de-duplicate (case-insensitively, matching the column). */
export function normalizeTags(tags: readonly string[]): string[] {
   const seen = new Set<string>();
   const normalized: string[] = [];
   for (const raw of tags) {
      const tag = String(raw).trim();
      const key = tag.toLowerCase();
      if (!tag || seen.has(key)) continue;
      seen.add(key);
      normalized.push(tag);
   }
   return normalized;
}

/** One `INSERT OR IGNORE` per 24 tag rows, so a 20-tag card is one statement. */
export function cardTagInsertStatements(env: AppEnv, rows: readonly CardTagInput[]): Statement[] {
   const tuples: string[][] = [];
   for (const row of rows) {
      for (const tag of normalizeTags(row.tags)) {
         tuples.push([row.cardId, row.ownerId, row.deckId, tag]);
      }
   }

   return chunk(tuples, TAGS_PER_INSERT_STATEMENT).map((batch) =>
      env.DB.prepare(
         `INSERT OR IGNORE INTO card_tags (card_id, owner_id, deck_id, tag)
          VALUES ${batch.map(() => '(?, ?, ?, ?)').join(', ')}`,
      ).bind(...batch.flat()),
   );
}

export function cardTagDeleteStatements(env: AppEnv, cardIds: readonly string[]): Statement[] {
   return chunk(cardIds, CARD_IDS_PER_DELETE).map((batch) =>
      env.DB.prepare(`DELETE FROM card_tags WHERE card_id IN (${placeholders(batch.length)})`).bind(
         ...batch,
      ),
   );
}

/** Delete then insert, both inside the caller's `db.batch()`. */
export function cardTagReplaceStatements(env: AppEnv, rows: readonly CardTagInput[]): Statement[] {
   if (rows.length === 0) return [];
   return [
      ...cardTagDeleteStatements(
         env,
         rows.map((row) => row.cardId),
      ),
      ...cardTagInsertStatements(env, rows),
   ];
}

/** Parse `cards.tags_json` defensively; malformed rows contribute no tags. */
export function parseTagsJson(value: unknown): string[] {
   if (typeof value !== 'string') return [];
   try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.map(String) : [];
   } catch {
      return [];
   }
}
