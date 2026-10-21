import type { AppEnv } from '../env';
import {
   deleteMediaRows,
   pruneAuditEvents,
   pruneDeletedCards,
   pruneMagicLinks,
   pruneRateLimitsBefore,
   pruneRevokedApiKeys,
   pruneSessions,
   selectOrphanedMedia,
} from '../repositories/maintenance';

export type CleanupSummary = {
   sessions: number;
   magicLinks: number;
   rateLimits: number;
   apiKeys: number;
   media: number;
   auditEvents: number;
   cards: number;
};

/** Retention windows for the periodic cleanup job. */
export const CLEANUP_RETENTION = {
   rateLimitsHours: 24,
   revokedApiKeyDays: 30,
   auditEventDays: 180,
   orphanMediaDays: 7,
   mediaBatchSize: 200,
   deletedCardDays: 30,
} as const;

/**
 * Periodic housekeeping (SPEC §5.4): prune expired/revoked auth artifacts and
 * delete orphaned R2 media objects. Idempotent and safe to run repeatedly.
 */
export async function runCleanup(env: AppEnv, now: Date = new Date()): Promise<CleanupSummary> {
   const iso = (date: Date) => date.toISOString();
   const agoDays = (days: number) => new Date(now.getTime() - days * 86_400_000);
   const agoHours = (hours: number) => new Date(now.getTime() - hours * 3_600_000);

   const [sessions, magicLinks, rateLimits, apiKeys, auditEvents] = await Promise.all([
      pruneSessions(env, iso(now)),
      pruneMagicLinks(env, iso(now)),
      pruneRateLimitsBefore(env, agoHours(CLEANUP_RETENTION.rateLimitsHours)),
      pruneRevokedApiKeys(env, iso(agoDays(CLEANUP_RETENTION.revokedApiKeyDays))),
      pruneAuditEvents(env, iso(agoDays(CLEANUP_RETENTION.auditEventDays))),
   ]);

   // Purge cards that have been soft-deleted for longer than the retention
   // window. Run this before media cleanup so their media becomes orphaned.
   const cards = await pruneDeletedCards(env, iso(agoDays(CLEANUP_RETENTION.deletedCardDays)));

   const orphans = await selectOrphanedMedia(
      env,
      iso(agoDays(CLEANUP_RETENTION.orphanMediaDays)),
      CLEANUP_RETENTION.mediaBatchSize,
   );
   for (const orphan of orphans) {
      await env.MEDIA.delete(orphan.r2_key).catch(() => undefined);
   }
   const media = await deleteMediaRows(
      env,
      orphans.map((orphan) => orphan.id),
   );

   return { sessions, magicLinks, rateLimits, apiKeys, media, auditEvents, cards };
}
