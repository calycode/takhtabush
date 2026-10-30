import { newId, nowIso } from '@caly/worker-kit';
import type { LearningState, ReviewEvent, StudySession, WeakCard } from '@caly/shared';
import type { AppEnv } from '../env';
import { chunk, D1_MAX_BOUND_PARAMS, placeholders } from '../lib/d1';
import { mapReviewEvent, mapSession } from '../lib/map';

export type LearningStateRow = {
   user_id: string;
   card_id: string;
   deck_id: string | null;
   scheduler_version: number;
   state_json: string;
   due_at: string | null;
   interval_days: number | null;
   ease: number | null;
   repetitions: number;
   lapses: number;
   last_reviewed_at: string | null;
};

export function mapLearningState(row: LearningStateRow): LearningState {
   return {
      userId: row.user_id,
      cardId: row.card_id,
      schedulerVersion: row.scheduler_version,
      state: JSON.parse(row.state_json || '{}') as Record<string, unknown>,
      dueAt: row.due_at,
      intervalDays: row.interval_days,
      ease: row.ease,
      repetitions: row.repetitions,
      lapses: row.lapses,
      lastReviewedAt: row.last_reviewed_at,
   };
}

export async function createStudySession(
   env: AppEnv,
   input: {
      id: string;
      userId: string;
      deckId: string;
      mode: string;
      strategy: string | null;
      plannedCardIds: string[];
      createdBy: string;
   },
): Promise<StudySession> {
   const id = input.id;
   const now = nowIso();
   await env.DB.prepare(
      `INSERT INTO study_sessions
         (id, user_id, deck_id, mode, strategy, planned_card_ids_json, status, started_at, completed_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?, NULL, ?)`,
   )
      .bind(
         id,
         input.userId,
         input.deckId,
         input.mode,
         input.strategy,
         JSON.stringify(input.plannedCardIds),
         now,
         input.createdBy,
      )
      .run();
   const row = await getStudySessionRow(env, id);
   if (!row) throw new Error('Failed to create study session');
   return mapSession(row);
}

export function getStudySessionRow(
   env: AppEnv,
   id: string,
): Promise<Record<string, unknown> | null> {
   return env.DB.prepare('SELECT * FROM study_sessions WHERE id = ?')
      .bind(id)
      .first<Record<string, unknown>>();
}

export async function completeStudySession(env: AppEnv, id: string): Promise<void> {
   await env.DB.prepare(
      "UPDATE study_sessions SET status = 'completed', completed_at = ? WHERE id = ?",
   )
      .bind(nowIso(), id)
      .run();
}

/** Mark an active session abandoned (user left before finishing). */
export async function abandonStudySession(env: AppEnv, id: string): Promise<void> {
   await env.DB.prepare(
      "UPDATE study_sessions SET status = 'abandoned', completed_at = ? WHERE id = ?",
   )
      .bind(nowIso(), id)
      .run();
}

/** A user's sessions, newest first, optionally filtered by status. */
export async function listSessionsForUser(
   env: AppEnv,
   userId: string,
   opts: { status?: string; limit: number },
): Promise<StudySession[]> {
   const params: unknown[] = [userId];
   let sql = 'SELECT * FROM study_sessions WHERE user_id = ?';
   if (opts.status) {
      sql += ' AND status = ?';
      params.push(opts.status);
   }
   sql += ' ORDER BY started_at DESC LIMIT ?';
   params.push(opts.limit);
   const result = await env.DB.prepare(sql)
      .bind(...params)
      .all<Record<string, unknown>>();
   return (result.results ?? []).map(mapSession);
}

export async function appendReviewEvent(
   env: AppEnv,
   input: {
      sessionId: string;
      cardId: string;
      userId: string;
      response: string;
      isCorrect: boolean;
      durationMs?: number;
      schedulerState: Record<string, unknown>;
   },
): Promise<ReviewEvent> {
   const id = newId('evt');
   const now = nowIso();
   await env.DB.prepare(
      `INSERT INTO review_events
         (id, session_id, card_id, user_id, response, is_correct, duration_ms, scheduler_state_json, reviewed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
   )
      .bind(
         id,
         input.sessionId,
         input.cardId,
         input.userId,
         input.response,
         input.isCorrect ? 1 : 0,
         input.durationMs ?? null,
         JSON.stringify(input.schedulerState),
         now,
      )
      .run();
   const row = await env.DB.prepare('SELECT * FROM review_events WHERE id = ?')
      .bind(id)
      .first<Record<string, unknown>>();
   if (!row) throw new Error('Failed to append review event');
   return mapReviewEvent(row);
}

export async function countSessionReviews(env: AppEnv, sessionId: string): Promise<number> {
   const row = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM review_events WHERE session_id = ?',
   )
      .bind(sessionId)
      .first<{ count: number }>();
   return Number(row?.count ?? 0);
}

export async function listReviewedCardIds(env: AppEnv, sessionId: string): Promise<Set<string>> {
   const result = await env.DB.prepare(
      'SELECT DISTINCT card_id FROM review_events WHERE session_id = ?',
   )
      .bind(sessionId)
      .all<{ card_id: string }>();
   return new Set((result.results ?? []).map((row) => row.card_id));
}

/**
 * How many distinct planned cards the session has reviewed. One aggregate
 * instead of loading every reviewed id just to compute `remaining`.
 */
export async function countReviewedCards(env: AppEnv, sessionId: string): Promise<number> {
   const row = await env.DB.prepare(
      'SELECT COUNT(DISTINCT card_id) AS count FROM review_events WHERE session_id = ?',
   )
      .bind(sessionId)
      .first<{ count: number }>();
   return Number(row?.count ?? 0);
}

export function getLearningState(
   env: AppEnv,
   userId: string,
   cardId: string,
): Promise<LearningStateRow | null> {
   return env.DB.prepare('SELECT * FROM learning_state WHERE user_id = ? AND card_id = ?')
      .bind(userId, cardId)
      .first<LearningStateRow>();
}

/**
 * Upsert derived state. `deck_id` is stored alongside the card so per-deck due
 * counts and forecasts use `idx_learning_deck_due` instead of scanning every
 * due row the user has. It is a denormalized copy of `cards.deck_id`; the
 * rebuild-from-events path can always restore it.
 */
export async function upsertLearningState(
   env: AppEnv,
   state: LearningState,
   deckId: string,
): Promise<void> {
   await env.DB.prepare(
      `INSERT INTO learning_state
         (user_id, card_id, deck_id, scheduler_version, state_json, due_at, interval_days, ease, repetitions, lapses, last_reviewed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, card_id) DO UPDATE SET
         deck_id = excluded.deck_id,
         scheduler_version = excluded.scheduler_version,
         state_json = excluded.state_json,
         due_at = excluded.due_at,
         interval_days = excluded.interval_days,
         ease = excluded.ease,
         repetitions = excluded.repetitions,
         lapses = excluded.lapses,
         last_reviewed_at = excluded.last_reviewed_at`,
   )
      .bind(
         state.userId,
         state.cardId,
         deckId,
         state.schedulerVersion,
         JSON.stringify(state.state),
         state.dueAt,
         state.intervalDays,
         state.ease,
         state.repetitions,
         state.lapses,
         state.lastReviewedAt,
      )
      .run();
}

export type DeckStudySummary = {
   total: number;
   new: number;
   due: number;
   typeCounts: Record<string, number>;
};

/** Card-type counts plus new/due counts for the study launcher. */
export async function getDeckStudySummary(
   env: AppEnv,
   userId: string,
   deckId: string,
   now: string = nowIso(),
): Promise<DeckStudySummary> {
   const typeResult = await env.DB.prepare(
      `SELECT type, COUNT(*) AS count FROM cards
        WHERE deck_id = ? AND deleted_at IS NULL AND status = 'active'
        GROUP BY type`,
   )
      .bind(deckId)
      .all<{ type: string; count: number }>();

   const typeCounts: Record<string, number> = {
      term_definition: 0,
      cloze: 0,
      multiple_choice: 0,
      typed: 0,
      image_prompt: 0,
   };
   let total = 0;
   for (const row of typeResult.results ?? []) {
      typeCounts[row.type] = Number(row.count);
      total += Number(row.count);
   }

   const newRow = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM cards c
        WHERE c.deck_id = ? AND c.deleted_at IS NULL AND c.status = 'active'
          AND NOT EXISTS (SELECT 1 FROM learning_state ls WHERE ls.card_id = c.id AND ls.user_id = ?)`,
   )
      .bind(deckId, userId)
      .first<{ count: number }>();

   const dueRow = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM cards c
        JOIN learning_state ls INDEXED BY idx_learning_deck_due ON ls.card_id = c.id AND ls.user_id = ?
        WHERE ls.deck_id = ? AND c.deck_id = ? AND c.deleted_at IS NULL AND c.status = 'active'
          AND ls.due_at IS NOT NULL AND ls.due_at <= ?`,
   )
      .bind(userId, deckId, deckId, now)
      .first<{ count: number }>();

   return {
      total,
      new: Number(newRow?.count ?? 0),
      due: Number(dueRow?.count ?? 0),
      typeCounts,
   };
}

/** Due counts grouped by deck for the whole owner (used by MCP list_decks). */
export async function deckDueCounts(
   env: AppEnv,
   userId: string,
   now: string,
   deckIds?: readonly string[],
): Promise<Record<string, number>> {
   const counts: Record<string, number> = {};
   const collect = (rows: Array<{ deck_id: string; count: number }>) => {
      for (const row of rows) counts[row.deck_id] = Number(row.count);
   };

   if (deckIds && deckIds.length === 0) return counts;

   if (!deckIds) {
      const result = await env.DB.prepare(
         `SELECT ls.deck_id AS deck_id, COUNT(*) AS count
            FROM learning_state ls INDEXED BY idx_learning_deck_due
            JOIN cards c ON c.id = ls.card_id
           WHERE ls.user_id = ? AND c.deleted_at IS NULL AND c.status = 'active'
             AND ls.deck_id IS NOT NULL
             AND ls.due_at IS NOT NULL AND ls.due_at <= ?
           GROUP BY ls.deck_id`,
      )
         .bind(userId, now)
         .all<{ deck_id: string; count: number }>();
      collect(result.results ?? []);
      return counts;
   }

   // Scope the aggregate to the page's decks. One parameter is the user, so a
   // chunk holds `D1_MAX_BOUND_PARAMS - 2` deck ids.
   for (const batch of chunk(deckIds, D1_MAX_BOUND_PARAMS - 2)) {
      const result = await env.DB.prepare(
         `SELECT ls.deck_id AS deck_id, COUNT(*) AS count
            FROM learning_state ls INDEXED BY idx_learning_deck_due
            JOIN cards c ON c.id = ls.card_id
           WHERE ls.user_id = ? AND ls.deck_id IN (${placeholders(batch.length)})
             AND c.deleted_at IS NULL AND c.status = 'active'
             AND ls.due_at IS NOT NULL AND ls.due_at <= ?
           GROUP BY ls.deck_id`,
      )
         .bind(userId, ...batch, now)
         .all<{ deck_id: string; count: number }>();
      collect(result.results ?? []);
   }
   return counts;
}

/** Every active card id in a deck (used by cram, which ignores the schedule). */
export async function listActiveCardIds(
   env: AppEnv,
   deckId: string,
   limit: number,
): Promise<string[]> {
   const result = await env.DB.prepare(
      `SELECT id FROM cards
        WHERE deck_id = ? AND deleted_at IS NULL AND status = 'active'
        ORDER BY created_at ASC LIMIT ?`,
   )
      .bind(deckId, limit)
      .all<{ id: string }>();
   return (result.results ?? []).map((row) => row.id);
}

/** Cards that have state and are due now. */
export async function listDueCardIds(
   env: AppEnv,
   userId: string,
   deckId: string,
   now: string,
   limit: number,
): Promise<string[]> {
   const result = await env.DB.prepare(
      `SELECT c.id FROM cards c
         JOIN learning_state ls INDEXED BY idx_learning_deck_due ON ls.card_id = c.id AND ls.user_id = ?
        WHERE ls.deck_id = ? AND c.deck_id = ? AND c.deleted_at IS NULL AND c.status = 'active'
          AND ls.due_at IS NOT NULL AND ls.due_at <= ?
        ORDER BY ls.due_at ASC
        LIMIT ?`,
   )
      .bind(userId, deckId, deckId, now, limit)
      .all<{ id: string }>();
   return (result.results ?? []).map((row) => row.id);
}

/** Cards in the deck the user has never reviewed. */
export async function listNewCardIds(
   env: AppEnv,
   userId: string,
   deckId: string,
   limit: number,
): Promise<string[]> {
   const result = await env.DB.prepare(
      `SELECT c.id FROM cards c
        WHERE c.deck_id = ? AND c.deleted_at IS NULL AND c.status = 'active'
          AND NOT EXISTS (SELECT 1 FROM learning_state ls WHERE ls.card_id = c.id AND ls.user_id = ?)
        ORDER BY c.created_at ASC
        LIMIT ?`,
   )
      .bind(deckId, userId, limit)
      .all<{ id: string }>();
   return (result.results ?? []).map((row) => row.id);
}

/**
 * Lowest-accuracy cards in the deck, worst first. `CROSS JOIN` stops SQLite
 * from reordering the join: the deck's (bounded) card set drives and probes
 * `idx_reviews_user_card` per card. Starting from `review_events` scanned every
 * event the user had ever recorded, across all decks.
 */
export async function listWeakCardIds(
   env: AppEnv,
   userId: string,
   deckId: string,
   limit: number,
): Promise<string[]> {
   const result = await env.DB.prepare(
      `SELECT c.id AS id, AVG(r.is_correct) AS accuracy
         FROM cards c
        CROSS JOIN review_events r
        WHERE c.deck_id = ? AND c.deleted_at IS NULL AND c.status = 'active'
          AND r.user_id = ? AND r.card_id = c.id
        GROUP BY c.id
       HAVING AVG(r.is_correct) < 0.8
        ORDER BY accuracy ASC
        LIMIT ?`,
   )
      .bind(deckId, userId, limit)
      .all<{ id: string }>();
   return (result.results ?? []).map((row) => row.id);
}

export async function getReviewAggregate(
   env: AppEnv,
   userId: string,
   deckId: string,
): Promise<{ total: number; correct: number }> {
   const row = await env.DB.prepare(
      `SELECT COUNT(*) AS total, COALESCE(SUM(r.is_correct), 0) AS correct
         FROM cards c
        CROSS JOIN review_events r
        WHERE c.deck_id = ? AND c.deleted_at IS NULL
          AND r.user_id = ? AND r.card_id = c.id`,
   )
      .bind(deckId, userId)
      .first<{ total: number; correct: number }>();
   return { total: Number(row?.total ?? 0), correct: Number(row?.correct ?? 0) };
}

export async function getDueForecast(
   env: AppEnv,
   userId: string,
   deckId: string,
   now: string,
   days: number,
): Promise<Array<{ date: string; count: number }>> {
   const result = await env.DB.prepare(
      `SELECT substr(ls.due_at, 1, 10) AS date, COUNT(*) AS count
         FROM learning_state ls INDEXED BY idx_learning_deck_due
         JOIN cards c ON c.id = ls.card_id
        WHERE ls.user_id = ? AND ls.deck_id = ? AND c.deck_id = ? AND c.deleted_at IS NULL
          AND ls.due_at IS NOT NULL AND ls.due_at >= ?
        GROUP BY date
        ORDER BY date ASC
        LIMIT ?`,
   )
      .bind(userId, deckId, deckId, now, days)
      .all<{ date: string; count: number }>();
   return (result.results ?? []).map((row) => ({ date: row.date, count: Number(row.count) }));
}

export async function getWeakCards(
   env: AppEnv,
   userId: string,
   deckId: string,
   limit: number,
): Promise<WeakCard[]> {
   const result = await env.DB.prepare(
      `SELECT c.id AS card_id, c.front AS front, AVG(r.is_correct) AS accuracy,
              MAX(ls.lapses) AS lapses
         FROM cards c
        CROSS JOIN review_events r
         LEFT JOIN learning_state ls ON ls.card_id = c.id AND ls.user_id = ?
        WHERE c.deck_id = ? AND c.deleted_at IS NULL
          AND r.user_id = ? AND r.card_id = c.id
        GROUP BY c.id
        ORDER BY accuracy ASC
        LIMIT ?`,
   )
      .bind(userId, deckId, userId, limit)
      .all<{ card_id: string; front: string; accuracy: number; lapses: number | null }>();
   return (result.results ?? []).map((row) => ({
      cardId: row.card_id,
      front: row.front.slice(0, 120),
      accuracy: Number(row.accuracy ?? 0),
      lapses: Number(row.lapses ?? 0),
   }));
}

/** Longest streak the stats screen reports; also bounds the rows it scans. */
export const MAX_STREAK_DAYS = 400;

/**
 * Consecutive days (UTC) ending today or yesterday on which the user reviewed.
 * The window keeps the scan bounded; `idx_reviews_user_time` serves it.
 */
export async function getReviewStreak(env: AppEnv, userId: string): Promise<number> {
   const cutoff = new Date(Date.now() - MAX_STREAK_DAYS * 86_400_000).toISOString();
   const result = await env.DB.prepare(
      `SELECT DISTINCT substr(reviewed_at, 1, 10) AS day
         FROM review_events
        WHERE user_id = ? AND reviewed_at >= ?
        ORDER BY day DESC
        LIMIT ?`,
   )
      .bind(userId, cutoff, MAX_STREAK_DAYS)
      .all<{ day: string }>();
   const days = new Set((result.results ?? []).map((row) => row.day));
   if (days.size === 0) return 0;

   const cursor = new Date();
   const iso = (date: Date) => date.toISOString().slice(0, 10);
   if (!days.has(iso(cursor))) {
      cursor.setUTCDate(cursor.getUTCDate() - 1);
      if (!days.has(iso(cursor))) return 0;
   }

   let streak = 0;
   while (days.has(iso(cursor)) && streak < MAX_STREAK_DAYS) {
      streak += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
   }
   return streak;
}
