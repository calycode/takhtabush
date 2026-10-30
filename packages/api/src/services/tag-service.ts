import type { TagSummary } from '@caly/shared';
import type { AppEnv } from '../env';
import { getOwnedDeck } from './deck-service';
import { listOwnedTagStrings } from '../repositories/cards';
import { getCachedGlobalTagSummary } from './cache-service';

async function countTags(env: AppEnv, userId: string, deckId?: string): Promise<TagSummary[]> {
   const tags = await listOwnedTagStrings(env, userId, deckId);
   const counts = new Map<string, number>();
   for (const tag of tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
   return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/**
 * Distinct tags across the user's cards, most used first.
 *
 * A deck-scoped request stays on the bounded card scan (at most
 * `LIMITS.cardsPerDeck` rows) and is never cached, because the editor needs the
 * deck's own tags immediately. The global summary scans every card the user
 * owns, so it is read through the KV cache with a five-minute window (SPEC
 * D39); a stale tag can only delay an autocomplete suggestion.
 */
export async function listTags(
   env: AppEnv,
   userId: string,
   deckId?: string,
): Promise<TagSummary[]> {
   if (deckId) {
      await getOwnedDeck(env, userId, deckId);
      return countTags(env, userId, deckId);
   }
   return getCachedGlobalTagSummary(env, userId, () => countTags(env, userId));
}
