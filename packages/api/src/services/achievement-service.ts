import { ACHIEVEMENTS, type Achievement, type AchievementDefinition } from '@caly/shared';
import type { AppEnv } from '../env';
import {
   getAchievementSnapshot,
   insertUserAchievements,
   listUserAchievements,
   markAchievementShared,
   markAchievementsSeen,
   type AchievementSnapshot,
} from '../repositories/achievements';
import { getCachedReviewStreak } from './cache-service';

type Rule = (snapshot: AchievementSnapshot) => boolean;

const atLeast = (value: number, minimum: number) => value >= minimum;
const accuracyAtLeast = (snapshot: AchievementSnapshot, reviews: number, accuracy: number) =>
   snapshot.totalReviews >= reviews && (snapshot.accuracy ?? 0) >= accuracy;

const RULES: Record<string, Rule> = {
   first_review: (s) => atLeast(s.totalReviews, 1),
   first_deck: (s) => atLeast(s.totalDecks, 1),
   first_card: (s) => atLeast(s.totalCards, 1),
   first_session: (s) => atLeast(s.completedSessions, 1),
   first_import: (s) => atLeast(s.importedCards, 1),
   first_collection: (s) => atLeast(s.collections, 1),

   streak_3: (s) => atLeast(s.streak, 3),
   streak_7: (s) => atLeast(s.streak, 7),
   streak_14: (s) => atLeast(s.streak, 14),
   streak_30: (s) => atLeast(s.streak, 30),
   streak_60: (s) => atLeast(s.streak, 60),
   streak_100: (s) => atLeast(s.streak, 100),

   reviews_10: (s) => atLeast(s.totalReviews, 10),
   reviews_50: (s) => atLeast(s.totalReviews, 50),
   reviews_100: (s) => atLeast(s.totalReviews, 100),
   reviews_500: (s) => atLeast(s.totalReviews, 500),
   reviews_1000: (s) => atLeast(s.totalReviews, 1_000),
   reviews_5000: (s) => atLeast(s.totalReviews, 5_000),
   reviews_10000: (s) => atLeast(s.totalReviews, 10_000),
   sessions_10: (s) => atLeast(s.completedSessions, 10),
   sessions_50: (s) => atLeast(s.completedSessions, 50),
   sessions_100: (s) => atLeast(s.completedSessions, 100),
   sessions_500: (s) => atLeast(s.completedSessions, 500),
   cards_100: (s) => atLeast(s.totalCards, 100),
   cards_500: (s) => atLeast(s.totalCards, 500),
   cards_1000: (s) => atLeast(s.totalCards, 1_000),
   decks_5: (s) => atLeast(s.totalDecks, 5),
   decks_10: (s) => atLeast(s.totalDecks, 10),
   decks_25: (s) => atLeast(s.totalDecks, 25),
   collections_5: (s) => atLeast(s.collections, 5),
   collections_10: (s) => atLeast(s.collections, 10),
   tags_10: (s) => atLeast(s.tags, 10),
   tags_25: (s) => atLeast(s.tags, 25),

   accuracy_80: (s) => accuracyAtLeast(s, 100, 0.8),
   accuracy_90: (s) => accuracyAtLeast(s, 250, 0.9),
   accuracy_95: (s) => accuracyAtLeast(s, 500, 0.95),
   perfect_session: (s) => atLeast(s.perfectSessions, 1),
   perfect_sessions_10: (s) => atLeast(s.perfectSessions, 10),
   fast_10: (s) => atLeast(s.fastCorrect, 10),
   fast_100: (s) => atLeast(s.fastCorrect, 100),
   fast_500: (s) => atLeast(s.fastCorrect, 500),
   easy_100: (s) => atLeast(s.easyReviews, 100),
   hard_100: (s) => atLeast(s.hardReviews, 100),
   again_100: (s) => atLeast(s.againReviews, 100),

   night_owl: (s) => atLeast(s.nightReviews, 50),
   early_bird: (s) => atLeast(s.earlyReviews, 50),

   mastered_10: (s) => atLeast(s.masteredCards, 10),
   mastered_50: (s) => atLeast(s.masteredCards, 50),
   mastered_100: (s) => atLeast(s.masteredCards, 100),
   mastered_250: (s) => atLeast(s.masteredCards, 250),
   mastered_500: (s) => atLeast(s.masteredCards, 500),
   deck_full: (s) => atLeast(s.maxDeckCards, 500),
   marathon: (s) => atLeast(s.maxSessionReviews, 100),
   import_500: (s) => atLeast(s.importedCards, 500),
   lapses_100: (s) => atLeast(s.totalLapses, 100),

   first_game: (s) => atLeast(s.gamesPlayed, 1),
   games_50: (s) => atLeast(s.gamesPlayed, 50),
   survival_first_win: (s) => atLeast(s.survivalWins, 1),
   survival_10_wins: (s) => atLeast(s.survivalWins, 10),
   survival_25_wins: (s) => atLeast(s.survivalWins, 25),
   boss_first_win: (s) => atLeast(s.bossWins, 1),
   boss_10_wins: (s) => atLeast(s.bossWins, 10),
   bosses_25: (s) => atLeast(s.bossesDefeated, 25),
   combo_10: (s) => atLeast(s.maxCombo, 10),
   combo_25: (s) => atLeast(s.maxCombo, 25),
   score_1000: (s) => atLeast(s.maxScore, 1_000),
   score_5000: (s) => atLeast(s.maxScore, 5_000),

   shared_achievement: (s) => atLeast(s.sharedAchievements, 1),
   shared_5: (s) => atLeast(s.sharedAchievements, 5),
};

function toAchievement(
   definition: AchievementDefinition,
   row: { unlockedAt: string | null; seenAt: string | null; sharedAt: string | null },
): Achievement {
   return { ...definition, ...row };
}

/** Evaluate all rules against a fresh snapshot and persist newly unlocked rows. */
export async function evaluateAchievements(env: AppEnv, userId: string): Promise<Achievement[]> {
   const streak = await getCachedReviewStreak(env, userId);
   const snapshot = await getAchievementSnapshot(env, userId, streak);
   const existing = new Set(
      (await listUserAchievements(env, userId)).map((row) => row.achievement_id),
   );
   const unlocked = ACHIEVEMENTS.filter(
      (definition) => !existing.has(definition.id) && RULES[definition.id]?.(snapshot),
   );
   if (unlocked.length === 0) return [];

   await insertUserAchievements(
      env,
      userId,
      unlocked.map((definition) => definition.id),
   );
   const now = new Date().toISOString();
   return unlocked.map((definition) =>
      toAchievement(definition, { unlockedAt: now, seenAt: null, sharedAt: null }),
   );
}

export async function getAchievementOverview(
   env: AppEnv,
   userId: string,
): Promise<{ items: Achievement[]; pending: Achievement[] }> {
   await evaluateAchievements(env, userId);
   const rows = await listUserAchievements(env, userId);
   const byId = new Map(rows.map((row) => [row.achievement_id, row]));

   const items = ACHIEVEMENTS.map((definition) => {
      const row = byId.get(definition.id);
      return toAchievement(definition, {
         unlockedAt: row?.unlocked_at ?? null,
         seenAt: row?.seen_at ?? null,
         sharedAt: row?.shared_at ?? null,
      });
   });
   return {
      items,
      pending: items.filter((item) => item.unlockedAt && !item.seenAt),
   };
}

export function markSeen(env: AppEnv, userId: string, ids: string[]): Promise<void> {
   return markAchievementsSeen(env, userId, ids);
}

export async function shareAchievement(
   env: AppEnv,
   userId: string,
   id: string,
): Promise<Achievement[]> {
   await markAchievementShared(env, userId, id);
   return evaluateAchievements(env, userId);
}

/** Exported for a catalog/rule parity test. */
export function achievementRules(): Readonly<Record<string, Rule>> {
   return RULES;
}

/** Every catalog entry must have an evaluation rule. */
export function missingAchievementRules(): string[] {
   return ACHIEVEMENTS.filter((definition) => !RULES[definition.id]).map(
      (definition) => definition.id,
   );
}
