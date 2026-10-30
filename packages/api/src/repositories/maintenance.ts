import type { AppEnv } from '../env';
import { chunk, D1_MAX_BOUND_PARAMS, placeholders } from '../lib/d1';

function changes(result: { meta?: { changes?: number } }): number {
   return result.meta?.changes ?? 0;
}

/** Delete sessions that are expired or were revoked before the cutoff. */
export async function pruneSessions(env: AppEnv, nowIso: string): Promise<number> {
   const result = await env.DB.prepare(
      'DELETE FROM sessions WHERE expires_at < ? OR (revoked_at IS NOT NULL AND revoked_at < ?)',
   )
      .bind(nowIso, nowIso)
      .run();
   return changes(result);
}

/** Delete magic-link tokens that are expired or were consumed before the cutoff. */
export async function pruneMagicLinks(env: AppEnv, nowIso: string): Promise<number> {
   const result = await env.DB.prepare(
      'DELETE FROM magic_link_tokens WHERE expires_at < ? OR (consumed_at IS NOT NULL AND consumed_at < ?)',
   )
      .bind(nowIso, nowIso)
      .run();
   return changes(result);
}

/** Delete fixed-window rate-limit rows older than `before` (epoch seconds). */
export async function pruneRateLimitsBefore(env: AppEnv, before: Date): Promise<number> {
   const result = await env.DB.prepare('DELETE FROM rate_limits WHERE window_start < ?')
      .bind(Math.floor(before.getTime() / 1000))
      .run();
   return changes(result);
}

/** Delete API keys revoked before the cutoff. */
export async function pruneRevokedApiKeys(env: AppEnv, beforeIso: string): Promise<number> {
   const result = await env.DB.prepare(
      'DELETE FROM api_keys WHERE revoked_at IS NOT NULL AND revoked_at < ?',
   )
      .bind(beforeIso)
      .run();
   return changes(result);
}

/** Delete MCP audit events older than the cutoff (retention). */
export async function pruneAuditEvents(env: AppEnv, beforeIso: string): Promise<number> {
   const result = await env.DB.prepare('DELETE FROM mcp_audit_events WHERE created_at < ?')
      .bind(beforeIso)
      .run();
   return changes(result);
}

/**
 * Hard-delete long-soft-deleted cards and every row that references them
 * (review events, revisions, learning state). This is the only place review
 * events are removed — normal operation never mutates them (SPEC D4).
 */
export async function pruneDeletedCards(env: AppEnv, beforeIso: string): Promise<number> {
   const predicate =
      'card_id IN (SELECT id FROM cards WHERE deleted_at IS NOT NULL AND deleted_at < ?)';

   await env.DB.prepare(`DELETE FROM review_events WHERE ${predicate}`).bind(beforeIso).run();
   await env.DB.prepare(`DELETE FROM card_tags WHERE ${predicate}`).bind(beforeIso).run();
   await env.DB.prepare(`DELETE FROM card_revisions WHERE ${predicate}`).bind(beforeIso).run();
   await env.DB.prepare(`DELETE FROM learning_state WHERE ${predicate}`).bind(beforeIso).run();
   const result = await env.DB.prepare(
      'DELETE FROM cards WHERE deleted_at IS NOT NULL AND deleted_at < ?',
   )
      .bind(beforeIso)
      .run();
   return changes(result);
}

export type OrphanMedia = { id: string; r2_key: string };

/** Media objects that are old and not referenced by any live card. */
export async function selectOrphanedMedia(
   env: AppEnv,
   beforeIso: string,
   limit: number,
): Promise<OrphanMedia[]> {
   const result = await env.DB.prepare(
      `SELECT m.id, m.r2_key FROM media_objects m
        WHERE m.created_at < ?
          AND NOT EXISTS (
             SELECT 1 FROM cards c
              WHERE c.deleted_at IS NULL
                AND (c.image_media_id = m.id OR c.audio_media_id = m.id)
          )
        LIMIT ?`,
   )
      .bind(beforeIso, limit)
      .all<OrphanMedia>();
   return result.results ?? [];
}

/** Delete media rows by id (R2 objects are removed separately). */
export async function deleteMediaRows(env: AppEnv, ids: string[]): Promise<number> {
   let deleted = 0;
   for (const batch of chunk(ids, D1_MAX_BOUND_PARAMS - 1)) {
      if (batch.length === 0) continue;
      const result = await env.DB.prepare(
         `DELETE FROM media_objects WHERE id IN (${placeholders(batch.length)})`,
      )
         .bind(...batch)
         .run();
      deleted += changes(result);
   }
   return deleted;
}
