import type { Context } from 'hono';
import type { AppEnv } from '../env';
import { AppError } from './errors';
import { incrementRateLimit, pruneRateLimits } from '../repositories/rate-limits';

/** Best-effort client identity for rate limiting. */
export function clientIp(c: Context): string {
   return (
      c.req.header('cf-connecting-ip') ??
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
      'unknown'
   );
}

/** Throw a 429 when `key` exceeds `limit` hits within `windowSeconds`. */
export async function enforceRateLimit(
   env: AppEnv,
   key: string,
   limit: number,
   windowSeconds: number,
): Promise<void> {
   const count = await incrementRateLimit(env, key, windowSeconds, new Date());
   if (count > limit) {
      throw new AppError('RATE_LIMITED', 'Too many requests. Please try again later.', 429, {
         retryAfterSeconds: windowSeconds,
      });
   }
   // Opportunistic cleanup so the table does not grow unbounded.
   if (Math.random() < 0.02) {
      await pruneRateLimits(env, new Date(Date.now() - 24 * 60 * 60 * 1000)).catch(() => undefined);
   }
}
