import type { DeckStats, OverviewStats } from '@caly/shared';
import { newId } from '@caly/worker-kit';
import type { AppEnv } from '../env';
import {
   getDueForecast,
   getReviewAccuracyTrend,
   getReviewActivity,
   getReviewAggregate,
   getUserReviewActivity,
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

   const [counts, aggregate, streak, forecast, weak, dueIds, activity, accuracyTrend] =
      await Promise.all([
         getDeckCounts(env, userId, deckId),
         getReviewAggregate(env, userId, deckId),
         getCachedReviewStreak(env, userId),
         getDueForecast(env, userId, deckId, nowIso, 14),
         getWeakCards(env, userId, deckId, 10),
         listDueCardIds(env, userId, deckId, nowIso, 500),
         getReviewActivity(env, userId, deckId, 112),
         getReviewAccuracyTrend(env, userId, deckId, 112),
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
      activity,
      accuracyTrend,
      weakCards: weak,
   };
}

/** Account-level streak and review activity for the dashboard overview. */
export async function computeOverviewStats(env: AppEnv, userId: string): Promise<OverviewStats> {
   const [streak, activity] = await Promise.all([
      getCachedReviewStreak(env, userId),
      getUserReviewActivity(env, userId, 112),
   ]);
   return { streak, activity };
}

/** Placeholder id generator reused by recommendation previews. */
export function previewSessionId(): string {
   return newId('stu');
}
