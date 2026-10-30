import type { TagSummary } from '@caly/shared';
import type { AppEnv } from '../env';
import { getOwnedDeck } from './deck-service';
import { listOwnedTagStrings } from '../repositories/cards';

/**
 * Distinct tags across the user's cards, most used first. Pass `deckId` to
 * scope the scan to one deck (at most `LIMITS.cardsPerDeck` rows); without it
 * the aggregate reads every card the user owns, which is why the UI always
 * asks per deck.
 */
export async function listTags(
   env: AppEnv,
   userId: string,
   deckId?: string,
): Promise<TagSummary[]> {
   if (deckId) await getOwnedDeck(env, userId, deckId);
   const tags = await listOwnedTagStrings(env, userId, deckId);
   const counts = new Map<string, number>();
   for (const tag of tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
   return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
