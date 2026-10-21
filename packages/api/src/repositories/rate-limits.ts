import type { AppEnv } from '../env';

/**
 * Increment the counter for `bucket` in the current fixed window and return the
 * new count. Windows are aligned to `windowSeconds` boundaries.
 */
export async function incrementRateLimit(
   env: AppEnv,
   bucket: string,
   windowSeconds: number,
   now: Date,
): Promise<number> {
   const windowStart = Math.floor(now.getTime() / 1000 / windowSeconds) * windowSeconds;
   await env.DB.prepare(
      `INSERT INTO rate_limits (bucket, window_start, count) VALUES (?, ?, 1)
       ON CONFLICT(bucket, window_start) DO UPDATE SET count = count + 1`,
   )
      .bind(bucket, windowStart)
      .run();

   const row = await env.DB.prepare(
      'SELECT count FROM rate_limits WHERE bucket = ? AND window_start = ?',
   )
      .bind(bucket, windowStart)
      .first<{ count: number }>();
   return Number(row?.count ?? 1);
}

/** Delete windows older than `olderThan` so the table stays small. */
export async function pruneRateLimits(env: AppEnv, olderThan: Date): Promise<void> {
   await env.DB.prepare('DELETE FROM rate_limits WHERE window_start < ?')
      .bind(Math.floor(olderThan.getTime() / 1000))
      .run();
}
