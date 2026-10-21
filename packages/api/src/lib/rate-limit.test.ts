import { describe, expect, it } from 'vitest';
import type { AppEnv } from '../env';
import { AppError } from './errors';
import { enforceRateLimit } from './rate-limit';

type Counter = { bucket: string; window_start: number; count: number };

function envWithRateLimits(): AppEnv {
   const rows: Counter[] = [];
   const db = {
      prepare: (sql: string) => ({
         bind: (...params: unknown[]) => ({
            run: async () => {
               if (sql.startsWith('INSERT INTO rate_limits')) {
                  const [bucket, windowStart] = params as [string, number];
                  const row = rows.find(
                     (r) => r.bucket === bucket && r.window_start === windowStart,
                  );
                  if (row) row.count += 1;
                  else rows.push({ bucket, window_start: windowStart, count: 1 });
               }
               return {};
            },
            first: async () => {
               if (sql.startsWith('SELECT count FROM rate_limits')) {
                  const [bucket, windowStart] = params as [string, number];
                  return (
                     rows.find((r) => r.bucket === bucket && r.window_start === windowStart) ?? null
                  );
               }
               return null;
            },
         }),
      }),
   };
   return { DB: db } as unknown as AppEnv;
}

describe('rate limiting', () => {
   it('allows up to the limit then throws 429', async () => {
      const env = envWithRateLimits();
      for (let i = 0; i < 3; i++) await enforceRateLimit(env, 'k', 3, 600);
      await expect(enforceRateLimit(env, 'k', 3, 600)).rejects.toBeInstanceOf(AppError);
      await expect(enforceRateLimit(env, 'k', 3, 600)).rejects.toMatchObject({
         status: 429,
         code: 'RATE_LIMITED',
      });
   });

   it('isolates buckets by key', async () => {
      const env = envWithRateLimits();
      await enforceRateLimit(env, 'a', 1, 600);
      await enforceRateLimit(env, 'b', 1, 600);
      await expect(enforceRateLimit(env, 'a', 1, 600)).rejects.toMatchObject({ status: 429 });
   });
});
