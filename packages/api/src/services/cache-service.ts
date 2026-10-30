import type { TagSummary } from '@caly/shared';
import type { AppEnv } from '../env';
import { getReviewStreak, MAX_STREAK_DAYS } from '../repositories/study';

/**
 * Read-through cache for derived, stale-tolerant data (SPEC D39).
 *
 * Only two values live here, both safe to serve slightly stale:
 *   - the review streak, which changes at most once per day;
 *   - the global tag summary, where a five-minute delay only affects
 *     autocomplete suggestions.
 *
 * Never cache auth/session/ownership, card or deck rows, due counts, or
 * anything a write must invalidate immediately. KV is eventually consistent,
 * so it is never used for authorization.
 *
 * Every helper fails open: a missing binding, a KV error, or a malformed value
 * falls back to the D1 computation. A cache failure must never fail a request.
 */

export const CACHE_KEY_PREFIX = 'cache:v1';
export const REVIEW_STREAK_TTL_SECONDS = 10 * 60;
export const TAG_SUMMARY_TTL_SECONDS = 5 * 60;

export function reviewStreakCacheKey(userId: string): string {
   return `${CACHE_KEY_PREFIX}:streak:${userId}`;
}

export function tagSummaryCacheKey(userId: string): string {
   return `${CACHE_KEY_PREFIX}:tags:${userId}`;
}

type Parser<T> = (value: unknown) => T | null;

async function readCache<T>(env: AppEnv, key: string, parse: Parser<T>): Promise<T | null> {
   if (!env.CACHE) return null;
   try {
      const raw = await env.CACHE.get(key);
      if (raw === null) return null;
      return parse(JSON.parse(raw) as unknown);
   } catch {
      // Missing namespace, KV outage, or malformed JSON: treat as a miss.
      return null;
   }
}

async function writeCache<T>(
   env: AppEnv,
   key: string,
   value: T,
   expirationTtl: number,
): Promise<void> {
   if (!env.CACHE) return;
   try {
      await env.CACHE.put(key, JSON.stringify(value), { expirationTtl });
   } catch {
      // The response is already correct without the cache write.
   }
}

export async function getCachedReviewStreak(
   env: AppEnv,
   userId: string,
   compute: () => Promise<number> = () => getReviewStreak(env, userId),
): Promise<number> {
   const key = reviewStreakCacheKey(userId);
   const cached = await readCache(env, key, (value) => {
      if (typeof value !== 'number' || !Number.isInteger(value)) return null;
      if (value < 0 || value > MAX_STREAK_DAYS) return null;
      return value;
   });
   if (cached !== null) return cached;

   const streak = await compute();
   await writeCache(env, key, streak, REVIEW_STREAK_TTL_SECONDS);
   return streak;
}

export async function getCachedGlobalTagSummary(
   env: AppEnv,
   userId: string,
   compute: () => Promise<TagSummary[]>,
): Promise<TagSummary[]> {
   const key = tagSummaryCacheKey(userId);
   const cached = await readCache(env, key, (value) => {
      if (!Array.isArray(value)) return null;
      const tags: TagSummary[] = [];
      for (const entry of value) {
         if (!entry || typeof entry !== 'object') return null;
         const record = entry as Record<string, unknown>;
         if (typeof record.name !== 'string' || typeof record.count !== 'number') return null;
         if (!Number.isFinite(record.count) || record.count < 0) return null;
         tags.push({ name: record.name, count: record.count });
      }
      return tags;
   });
   if (cached !== null) return cached;

   const tags = await compute();
   await writeCache(env, key, tags, TAG_SUMMARY_TTL_SECONDS);
   return tags;
}
