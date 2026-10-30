import { describe, expect, it } from 'vitest';
import type { AppEnv } from '../env';
import { ftsMatchExpression, searchCardsPage } from './cards';
import { normalizeTags, parseTagsJson } from './card-tags';
import { FakeD1, fakeEnv } from '../test/fake-d1';

const OWNER = 'usr_search_test';

function env(db: FakeD1): AppEnv {
   return fakeEnv(db) as unknown as AppEnv;
}

function searchDb(): FakeD1 {
   return new FakeD1([
      {
         match: /^SELECT \* FROM \(/,
         respond: () => ({ all: [] }),
      },
   ]);
}

describe('search index selection', () => {
   it('uses card_tags for a tag filter instead of a tags_json LIKE', async () => {
      const db = searchDb();
      await searchCardsPage(env(db), { ownerId: OWNER, tag: 'Spanish', limit: 20 });

      const sql = db.statements[0]!.sql;
      expect(sql).toContain('card_tags ct CROSS JOIN cards c');
      expect(sql).toContain('ct.tag = ?');
      expect(sql).not.toContain('tags_json LIKE');
      expect(db.statements[0]!.params).toContain('Spanish');
   });

   it('uses the trigram FTS table for a query of three or more characters', async () => {
      const db = searchDb();
      await searchCardsPage(env(db), { ownerId: OWNER, query: 'apple', limit: 20 });

      const sql = db.statements[0]!.sql;
      expect(sql).toContain('cards_fts CROSS JOIN cards c');
      expect(sql).toContain('cards_fts MATCH ?');
      expect(sql).not.toContain('front LIKE');
   });

   it('falls back to LIKE below the trigram minimum', async () => {
      const db = searchDb();
      await searchCardsPage(env(db), { ownerId: OWNER, query: 'ab', limit: 20 });

      const sql = db.statements[0]!.sql;
      expect(sql).toContain('c.front LIKE ?');
      expect(sql).not.toContain('cards_fts');
   });

   it('keeps LIKE for a deck-scoped query, which the cap already bounds', async () => {
      const db = searchDb();
      await searchCardsPage(env(db), {
         ownerId: OWNER,
         deckId: 'deck_1',
         query: 'apple',
         limit: 20,
      });

      const sql = db.statements[0]!.sql;
      expect(sql).toContain('c.front LIKE ?');
      expect(sql).not.toContain('cards_fts');
   });
});

describe('ftsMatchExpression', () => {
   it('returns null for short queries and quotes longer ones', () => {
      expect(ftsMatchExpression('ab')).toBeNull();
      expect(ftsMatchExpression('  a  ')).toBeNull();
      expect(ftsMatchExpression('abc')).toBe('front : "abc"');
      expect(ftsMatchExpression('say "hi"')).toBe('front : "say ""hi"""');
   });
});

describe('tag normalization', () => {
   it('trims, drops empties, and de-duplicates', () => {
      expect(normalizeTags([' Spanish ', '', 'spanish', 'verbs'])).toEqual(['Spanish', 'verbs']);
   });

   it('parses tags defensively', () => {
      expect(parseTagsJson('["a","b"]')).toEqual(['a', 'b']);
      expect(parseTagsJson('not json')).toEqual([]);
      expect(parseTagsJson(null)).toEqual([]);
   });
});
