import { nowIso } from '@caly/worker-kit';
import type { AppEnv } from '../env';

export type AchievementSnapshot = {
   totalReviews: number;
   correctReviews: number;
   accuracy: number | null;
   fastCorrect: number;
   easyReviews: number;
   hardReviews: number;
   againReviews: number;
   nightReviews: number;
   earlyReviews: number;
   streak: number;
   totalSessions: number;
   completedSessions: number;
   perfectSessions: number;
   maxSessionReviews: number;
   totalDecks: number;
   totalCards: number;
   importedCards: number;
   masteredCards: number;
   totalLapses: number;
   maxDeckCards: number;
   collections: number;
   tags: number;
   gamesPlayed: number;
   survivalWins: number;
   bossWins: number;
   bossesDefeated: number;
   maxScore: number;
   maxCombo: number;
   sharedAchievements: number;
};

export type UserAchievementRow = {
   achievement_id: string;
   unlocked_at: string;
   seen_at: string | null;
   shared_at: string | null;
};

export async function listUserAchievements(
   env: AppEnv,
   userId: string,
): Promise<UserAchievementRow[]> {
   const result = await env.DB.prepare(
      `SELECT achievement_id, unlocked_at, seen_at, shared_at
         FROM user_achievements
        WHERE user_id = ?
        ORDER BY unlocked_at DESC`,
   )
      .bind(userId)
      .all<UserAchievementRow>();
   return result.results ?? [];
}

export async function insertUserAchievements(
   env: AppEnv,
   userId: string,
   ids: string[],
): Promise<void> {
   if (ids.length === 0) return;
   const unlockedAt = nowIso();
   await env.DB.batch(
      ids.map((id) =>
         env.DB.prepare(
            `INSERT OR IGNORE INTO user_achievements (user_id, achievement_id, unlocked_at)
             VALUES (?, ?, ?)`,
         ).bind(userId, id, unlockedAt),
      ),
   );
}

export async function markAchievementsSeen(
   env: AppEnv,
   userId: string,
   ids: string[],
): Promise<void> {
   if (ids.length === 0) return;
   const seenAt = nowIso();
   await env.DB.batch(
      ids.map((id) =>
         env.DB.prepare(
            `UPDATE user_achievements SET seen_at = ?
              WHERE user_id = ? AND achievement_id = ?`,
         ).bind(seenAt, userId, id),
      ),
   );
}

export async function markAchievementShared(
   env: AppEnv,
   userId: string,
   id: string,
): Promise<void> {
   await env.DB.prepare(
      `UPDATE user_achievements SET shared_at = COALESCE(shared_at, ?)
        WHERE user_id = ? AND achievement_id = ?`,
   )
      .bind(nowIso(), userId, id)
      .run();
}

type ReviewMetrics = {
   total: number;
   correct: number;
   fast_correct: number;
   easy: number;
   hard: number;
   again: number;
   night: number;
   early: number;
};

type SessionMetrics = {
   total_sessions: number;
   completed_sessions: number;
   perfect_sessions: number;
   max_session_reviews: number;
};

type ContentMetrics = {
   decks: number;
   cards: number;
   imported_cards: number;
   mastered_cards: number;
   total_lapses: number;
   max_deck_cards: number;
   collections: number;
   tags: number;
};

type GameMetrics = {
   games_played: number;
   survival_wins: number;
   boss_wins: number;
   bosses_defeated: number;
   max_score: number;
   max_combo: number;
};

type SharedMetrics = { shared_achievements: number };

export async function getAchievementSnapshot(
   env: AppEnv,
   userId: string,
   streak: number,
): Promise<AchievementSnapshot> {
   const [reviews, sessions, content, games, shared] = await Promise.all([
      env.DB.prepare(
         `SELECT COUNT(*) AS total,
                 COALESCE(SUM(is_correct), 0) AS correct,
                 COALESCE(SUM(CASE WHEN is_correct = 1 AND duration_ms IS NOT NULL AND duration_ms <= 3000 THEN 1 ELSE 0 END), 0) AS fast_correct,
                 COALESCE(SUM(CASE WHEN response = 'easy' THEN 1 ELSE 0 END), 0) AS easy,
                 COALESCE(SUM(CASE WHEN response = 'hard' THEN 1 ELSE 0 END), 0) AS hard,
                 COALESCE(SUM(CASE WHEN response = 'again' THEN 1 ELSE 0 END), 0) AS again,
                 COALESCE(SUM(CASE WHEN CAST(substr(reviewed_at, 12, 2) AS INTEGER) < 5 THEN 1 ELSE 0 END), 0) AS night,
                 COALESCE(SUM(CASE WHEN CAST(substr(reviewed_at, 12, 2) AS INTEGER) >= 5
                                     AND CAST(substr(reviewed_at, 12, 2) AS INTEGER) < 8 THEN 1 ELSE 0 END), 0) AS early
            FROM review_events
           WHERE user_id = ?`,
      )
         .bind(userId)
         .first<ReviewMetrics>(),
      env.DB.prepare(
         `SELECT
             (SELECT COUNT(*) FROM study_sessions WHERE user_id = ?) AS total_sessions,
             (SELECT COUNT(*) FROM study_sessions WHERE user_id = ? AND status = 'completed') AS completed_sessions,
             (SELECT COUNT(*) FROM (
                SELECT session_id, COUNT(*) AS total, COALESCE(SUM(is_correct), 0) AS correct
                  FROM review_events
                 WHERE user_id = ?
                 GROUP BY session_id
                HAVING total >= 10 AND correct = total
             )) AS perfect_sessions,
             (SELECT COALESCE(MAX(total), 0) FROM (
                SELECT COUNT(*) AS total FROM review_events WHERE user_id = ? GROUP BY session_id
             )) AS max_session_reviews`,
      )
         .bind(userId, userId, userId, userId)
         .first<SessionMetrics>(),
      env.DB.prepare(
         `SELECT
             (SELECT COUNT(*) FROM decks WHERE owner_id = ? AND deleted_at IS NULL) AS decks,
             (SELECT COUNT(*) FROM cards WHERE owner_id = ? AND deleted_at IS NULL) AS cards,
             (SELECT COUNT(*) FROM cards WHERE owner_id = ? AND deleted_at IS NULL AND source = 'import') AS imported_cards,
             (SELECT COUNT(*) FROM learning_state ls
                JOIN cards c ON c.id = ls.card_id
               WHERE ls.user_id = ? AND c.deleted_at IS NULL AND ls.interval_days >= 21) AS mastered_cards,
             (SELECT COALESCE(SUM(lapses), 0) FROM learning_state WHERE user_id = ?) AS total_lapses,
             (SELECT COALESCE(MAX(total), 0) FROM (
                SELECT COUNT(*) AS total FROM cards WHERE owner_id = ? AND deleted_at IS NULL GROUP BY deck_id
             )) AS max_deck_cards,
             (SELECT COUNT(*) FROM collections WHERE owner_id = ? AND deleted_at IS NULL) AS collections,
             (SELECT COUNT(DISTINCT tag) FROM card_tags WHERE owner_id = ?) AS tags`,
      )
         .bind(userId, userId, userId, userId, userId, userId, userId, userId)
         .first<ContentMetrics>(),
      env.DB.prepare(
         `SELECT
             COUNT(*) AS games_played,
             COALESCE(SUM(CASE WHEN mode = 'survival' AND result = 'won' THEN 1 ELSE 0 END), 0) AS survival_wins,
             COALESCE(SUM(CASE WHEN mode = 'boss' AND result = 'won' THEN 1 ELSE 0 END), 0) AS boss_wins,
             COALESCE(SUM(bosses_defeated), 0) AS bosses_defeated,
             COALESCE(MAX(score), 0) AS max_score,
             COALESCE(MAX(best_combo), 0) AS max_combo
            FROM game_results
           WHERE user_id = ?`,
      )
         .bind(userId)
         .first<GameMetrics>(),
      env.DB.prepare(
         `SELECT COUNT(*) AS shared_achievements
            FROM user_achievements
           WHERE user_id = ? AND shared_at IS NOT NULL`,
      )
         .bind(userId)
         .first<SharedMetrics>(),
   ]);

   const totalReviews = Number(reviews?.total ?? 0);
   const correctReviews = Number(reviews?.correct ?? 0);

   return {
      totalReviews,
      correctReviews,
      accuracy: totalReviews > 0 ? correctReviews / totalReviews : null,
      fastCorrect: Number(reviews?.fast_correct ?? 0),
      easyReviews: Number(reviews?.easy ?? 0),
      hardReviews: Number(reviews?.hard ?? 0),
      againReviews: Number(reviews?.again ?? 0),
      nightReviews: Number(reviews?.night ?? 0),
      earlyReviews: Number(reviews?.early ?? 0),
      streak,
      totalSessions: Number(sessions?.total_sessions ?? 0),
      completedSessions: Number(sessions?.completed_sessions ?? 0),
      perfectSessions: Number(sessions?.perfect_sessions ?? 0),
      maxSessionReviews: Number(sessions?.max_session_reviews ?? 0),
      totalDecks: Number(content?.decks ?? 0),
      totalCards: Number(content?.cards ?? 0),
      importedCards: Number(content?.imported_cards ?? 0),
      masteredCards: Number(content?.mastered_cards ?? 0),
      totalLapses: Number(content?.total_lapses ?? 0),
      maxDeckCards: Number(content?.max_deck_cards ?? 0),
      collections: Number(content?.collections ?? 0),
      tags: Number(content?.tags ?? 0),
      gamesPlayed: Number(games?.games_played ?? 0),
      survivalWins: Number(games?.survival_wins ?? 0),
      bossWins: Number(games?.boss_wins ?? 0),
      bossesDefeated: Number(games?.bosses_defeated ?? 0),
      maxScore: Number(games?.max_score ?? 0),
      maxCombo: Number(games?.max_combo ?? 0),
      sharedAchievements: Number(shared?.shared_achievements ?? 0),
   };
}
