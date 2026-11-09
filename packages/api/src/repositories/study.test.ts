import { describe, expect, it } from 'vitest';
import type { AppEnv } from '../env';
import { FakeD1, fakeEnv } from '../test/fake-d1';
import { getUserReviewActivity } from './study';

describe('getUserReviewActivity', () => {
   it('aggregates reviews across all decks without joining cards', async () => {
      const db = new FakeD1([
         {
            match: /FROM review_events/,
            respond: () => ({
               all: [
                  { date: '2026-01-01', count: 3 },
                  { date: '2026-01-02', count: 1 },
               ],
            }),
         },
      ]);

      const activity = await getUserReviewActivity(fakeEnv(db) as unknown as AppEnv, 'usr_1', 112);

      expect(activity).toEqual([
         { date: '2026-01-01', count: 3 },
         { date: '2026-01-02', count: 1 },
      ]);

      const statement = db.statements[0]!;
      expect(statement.sql).toContain('FROM review_events');
      expect(statement.sql).not.toContain('cards c');
      expect(statement.params[0]).toBe('usr_1');
      expect(typeof statement.params[1]).toBe('string');
   });

   it('returns an empty list when there are no reviews', async () => {
      const db = new FakeD1([{ match: /FROM review_events/, respond: () => ({ all: [] }) }]);

      await expect(
         getUserReviewActivity(fakeEnv(db) as unknown as AppEnv, 'usr_1', 112),
      ).resolves.toEqual([]);
   });
});
