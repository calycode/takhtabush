import type { DeckStats } from '@caly/shared';
import { newId } from '@caly/worker-kit';
import type { AppEnv } from '../env';
import {
   getDueForecast,
   getReviewAggregate,
   getWeakCards,
   listDueCardIds,
} from '../repositories/study';
import { getDeckCounts } from '../repositories/stats';
import { getCachedReviewStreak } from './cache-service';
import { getOwnedDeck } from './deck-service';

export async function computeDeckStats(
   env: AppEnv,
   userId: string,
   deckId: string,
): Promise<DeckStats> {
   await getOwnedDeck(env, userId, deckId);
   const now = new Date();
   const nowIso = now.toISOString();

   const [counts, aggregate, streak, forecast, weak, dueIds] = await Promise.all([
      getDeckCounts(env, userId, deckId),
      getReviewAggregate(env, userId, deckId),
      getCachedReviewStreak(env, userId),
      getDueForecast(env, userId, deckId, nowIso, 14),
      getWeakCards(env, userId, deckId, 10),
      listDueCardIds(env, userId, deckId, nowIso, 500),
   ]);

   return {
      deckId,
      totalCards: counts.totalCards,
      newCards: counts.newCards,
      dueCards: dueIds.length,
      learningCards: counts.learningCards,
      suspendedCards: counts.suspendedCards,
      totalReviews: aggregate.total,
      accuracy: aggregate.total > 0 ? aggregate.correct / aggregate.total : null,
      streak,
      dueForecast: forecast,
      weakCards: weak,
   };
}

/** Placeholder id generator reused by recommendation previews. */
export function previewSessionId(): string {
   return newId('stu');
}
