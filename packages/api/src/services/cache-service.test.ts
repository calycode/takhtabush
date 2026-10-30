import { describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../env';
import { fakeEnv } from '../test/fake-d1';
import {
   getCachedGlobalTagSummary,
   getCachedReviewStreak,
   REVIEW_STREAK_TTL_SECONDS,
   reviewStreakCacheKey,
   TAG_SUMMARY_TTL_SECONDS,
   tagSummaryCacheKey,
} from './cache-service';

class FakeKv {
   readonly store = new Map<string, string>();
   readonly puts: Array<{ key: string; value: string; options?: { expirationTtl?: number } }> = [];
   failGet = false;
   failPut = false;

   async get(key: string): Promise<string | null> {
      if (this.failGet) throw new Error('kv read failed');
      return this.store.get(key) ?? null;
   }

   async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
      if (this.failPut) throw new Error('kv write failed');
      this.puts.push({ key, value, options });
      this.store.set(key, value);
   }
}

function envWith(kv?: FakeKv): AppEnv {
   const base = fakeEnv({} as never) as unknown as AppEnv;
   return { ...base, CACHE: kv as unknown as KVNamespace };
}

describe('review streak cache', () => {
   it('computes on a miss and writes with the documented TTL', async () => {
      const kv = new FakeKv();
      const compute = vi.fn(async () => 7);

      await expect(getCachedReviewStreak(envWith(kv), 'usr_1', compute)).resolves.toBe(7);

      expect(compute).toHaveBeenCalledTimes(1);
      expect(kv.puts).toEqual([
         {
            key: reviewStreakCacheKey('usr_1'),
            value: '7',
            options: { expirationTtl: REVIEW_STREAK_TTL_SECONDS },
         },
      ]);
      expect(reviewStreakCacheKey('usr_1')).toBe('cache:v1:streak:usr_1');
   });

   it('serves a hit without touching D1', async () => {
      const kv = new FakeKv();
      kv.store.set(reviewStreakCacheKey('usr_1'), '12');
      const compute = vi.fn(async () => 0);

      await expect(getCachedReviewStreak(envWith(kv), 'usr_1', compute)).resolves.toBe(12);
      expect(compute).not.toHaveBeenCalled();
   });

   it('ignores a malformed cached value', async () => {
      const kv = new FakeKv();
      kv.store.set(reviewStreakCacheKey('usr_1'), JSON.stringify({ streak: 4 }));
      const compute = vi.fn(async () => 4);

      await expect(getCachedReviewStreak(envWith(kv), 'usr_1', compute)).resolves.toBe(4);
      expect(compute).toHaveBeenCalledTimes(1);
   });

   it('fails open when KV reads and writes both throw', async () => {
      const kv = new FakeKv();
      kv.failGet = true;
      kv.failPut = true;
      const compute = vi.fn(async () => 3);

      await expect(getCachedReviewStreak(envWith(kv), 'usr_1', compute)).resolves.toBe(3);
      expect(compute).toHaveBeenCalledTimes(1);
   });

   it('fails open when no CACHE binding exists', async () => {
      const compute = vi.fn(async () => 5);

      await expect(getCachedReviewStreak(envWith(), 'usr_1', compute)).resolves.toBe(5);
      expect(compute).toHaveBeenCalledTimes(1);
   });
});

describe('global tag summary cache', () => {
   it('computes on a miss and caches the summary for five minutes', async () => {
      const kv = new FakeKv();
      const tags = [{ name: 'spanish', count: 3 }];
      const compute = vi.fn(async () => tags);

      await expect(getCachedGlobalTagSummary(envWith(kv), 'usr_1', compute)).resolves.toEqual(tags);

      expect(kv.puts[0]).toMatchObject({
         key: tagSummaryCacheKey('usr_1'),
         value: JSON.stringify(tags),
         options: { expirationTtl: TAG_SUMMARY_TTL_SECONDS },
      });
      expect(tagSummaryCacheKey('usr_1')).toBe('cache:v1:tags:usr_1');
   });

   it('serves a hit, ignores malformed values, and survives KV failure', async () => {
      const kv = new FakeKv();
      kv.store.set(tagSummaryCacheKey('usr_1'), JSON.stringify([{ name: 'verbs', count: 2 }]));
      const hit = vi.fn(async () => []);
      await expect(getCachedGlobalTagSummary(envWith(kv), 'usr_1', hit)).resolves.toEqual([
         { name: 'verbs', count: 2 },
      ]);
      expect(hit).not.toHaveBeenCalled();

      kv.store.set(tagSummaryCacheKey('usr_2'), 'not json');
      const miss = vi.fn(async () => [{ name: 'nouns', count: 1 }]);
      await expect(getCachedGlobalTagSummary(envWith(kv), 'usr_2', miss)).resolves.toEqual([
         { name: 'nouns', count: 1 },
      ]);
      expect(miss).toHaveBeenCalledTimes(1);

      const broken = new FakeKv();
      broken.failGet = true;
      broken.failPut = true;
      const fallback = vi.fn(async () => [{ name: 'verbs', count: 9 }]);
      await expect(getCachedGlobalTagSummary(envWith(broken), 'usr_3', fallback)).resolves.toEqual([
         { name: 'verbs', count: 9 },
      ]);
      expect(fallback).toHaveBeenCalledTimes(1);
   });
});
