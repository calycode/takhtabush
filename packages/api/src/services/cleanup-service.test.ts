import { describe, expect, it } from 'vitest';
import type { AppEnv } from '../env';
import { runCleanup } from './cleanup-service';

class CleanupDb {
   deletes: string[] = [];
   orphans = [
      { id: 'med_1', r2_key: 'media/u/med_1/a.png' },
      { id: 'med_2', r2_key: 'media/u/med_2/b.png' },
   ];

   prepare(sql: string) {
      const rows = this.orphans;
      const deletes = this.deletes;
      return {
         bind(...params: unknown[]) {
            return {
               async run() {
                  deletes.push(sql);
                  return {
                     meta: {
                        changes: sql.startsWith('DELETE FROM media_objects') ? params.length : 3,
                     },
                  };
               },
               async all() {
                  return { results: sql.includes('SELECT m.id') ? rows : [] };
               },
               async first() {
                  return null;
               },
            };
         },
      };
   }
}

describe('cleanup job', () => {
   it('prunes auth artifacts and orphaned media', async () => {
      const db = new CleanupDb();
      const r2Deleted: string[] = [];
      const env = {
         DB: db as unknown as D1Database,
         MEDIA: {
            delete: async (key: string) => {
               r2Deleted.push(key);
            },
         } as unknown as R2Bucket,
      } as unknown as AppEnv;

      const summary = await runCleanup(env, new Date('2026-01-01T00:00:00.000Z'));

      expect(summary).toEqual({
         sessions: 3,
         magicLinks: 3,
         rateLimits: 3,
         apiKeys: 3,
         auditEvents: 3,
         cards: 3,
         media: 2,
      });
      expect(r2Deleted).toEqual(['media/u/med_1/a.png', 'media/u/med_2/b.png']);
      expect(db.deletes.some((sql) => sql.includes('DELETE FROM sessions'))).toBe(true);
      expect(db.deletes.some((sql) => sql.includes('DELETE FROM media_objects'))).toBe(true);
   });
});
