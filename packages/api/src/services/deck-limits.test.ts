import { describe, expect, it } from 'vitest';
import {
   LIMIT_ERROR_CODES,
   MAX_CARDS_PER_BULK_CREATE,
   MAX_CARDS_PER_DECK,
   MAX_DECKS_PER_COLLECTION,
   type CreateCardInput,
} from '@caly/shared';
import type { AppEnv } from '../env';
import { createCards, createCard, restoreCard } from '../services/card-service';
import { createDeck } from '../services/deck-service';
import { importIntoDeck } from '../services/import-service';
import { FakeD1, fakeEnv, type FakeHandler } from '../test/fake-d1';

const OWNER = 'usr_limit_test';
const DECK = 'deck_limit_test';

function deckRow(cardCount: number) {
   const now = '2026-10-30T00:00:00.000Z';
   return {
      id: DECK,
      owner_id: OWNER,
      title: 'Limit test',
      description: null,
      collection_id: null,
      visibility: 'private',
      card_count: cardCount,
      created_at: now,
      updated_at: now,
      deleted_at: null,
   };
}

function cardRow(id: string, deletedAt: string | null = null) {
   const now = '2026-10-30T00:00:00.000Z';
   return {
      id,
      deck_id: DECK,
      owner_id: OWNER,
      type: 'term_definition',
      front: `front ${id}`,
      back: 'back',
      cloze_text: null,
      choices_json: null,
      correct_choice: null,
      image_media_id: null,
      audio_media_id: null,
      tags_json: '[]',
      status: 'active',
      source: 'manual',
      created_at: now,
      updated_at: now,
      deleted_at: deletedAt,
   };
}

const card: CreateCardInput = {
   type: 'term_definition',
   front: 'front',
   back: 'back',
   tags: [],
   status: 'active',
   source: 'manual',
};

function env(db: FakeD1): AppEnv {
   return fakeEnv(db) as unknown as AppEnv;
}

const SELECT_DECK = /^SELECT \* FROM decks WHERE id = \?/;
const RESERVE = /^UPDATE decks SET card_count = card_count \+ \?/;
const INSERT_CARD = /^INSERT INTO cards/;
const SELECT_CARDS_IN = /^SELECT \* FROM cards[\s\S]*id IN \(/;

describe('deck card cap', () => {
   it('rejects a single card when the reservation finds the deck full', async () => {
      const db = new FakeD1([
         { match: SELECT_DECK, respond: () => ({ first: deckRow(MAX_CARDS_PER_DECK) }) },
         { match: RESERVE, respond: () => ({ changes: 0 }) },
      ]);

      await expect(createCard(env(db), OWNER, DECK, card)).rejects.toMatchObject({
         code: LIMIT_ERROR_CODES.cardsPerDeck,
         status: 409,
         details: {
            limit: MAX_CARDS_PER_DECK,
            current: MAX_CARDS_PER_DECK,
            requested: 1,
            deckId: DECK,
         },
      });
      expect(db.has(INSERT_CARD)).toBe(false);
   });

   it('reserves one slot and writes one card under the cap', async () => {
      const db = new FakeD1([
         { match: SELECT_DECK, respond: () => ({ first: deckRow(10) }) },
         { match: RESERVE, respond: () => ({ changes: 1 }) },
         { match: INSERT_CARD, respond: () => ({ changes: 1 }) },
         {
            match: /^SELECT \* FROM cards WHERE id = \? AND deleted_at IS NULL/,
            respond: (params) => ({ first: cardRow(String(params[0])) }),
         },
      ]);

      const created = await createCard(env(db), OWNER, DECK, card);
      expect(created.deckId).toBe(DECK);
      expect(db.count(/^UPDATE decks SET card_count/)).toBe(1);
      expect(db.count(INSERT_CARD)).toBe(1);
   });

   it('rejects a restore that would cross the cap', async () => {
      const db = new FakeD1([
         {
            match: /^SELECT \* FROM cards WHERE id = \?$/,
            respond: () => ({ first: cardRow('card_restore', '2026-10-01T00:00:00.000Z') }),
         },
         { match: SELECT_DECK, respond: () => ({ first: deckRow(MAX_CARDS_PER_DECK) }) },
         { match: RESERVE, respond: () => ({ changes: 0 }) },
      ]);

      await expect(restoreCard(env(db), OWNER, 'card_restore')).rejects.toMatchObject({
         code: LIMIT_ERROR_CODES.cardsPerDeck,
      });
      expect(db.has(/^UPDATE cards SET deleted_at = NULL/)).toBe(false);
   });

   it('rejects an oversized bulk create before writing anything', async () => {
      const db = new FakeD1([]);
      const cards = Array.from({ length: MAX_CARDS_PER_BULK_CREATE + 1 }, () => card);
      await expect(createCards(env(db), OWNER, DECK, cards)).rejects.toMatchObject({
         code: LIMIT_ERROR_CODES.cardsPerBulkCreate,
      });
      expect(db.statements).toHaveLength(0);
   });

   it('batch-creates cards with one reservation and one batch per 50 rows', async () => {
      const handlers: FakeHandler[] = [
         { match: SELECT_DECK, respond: () => ({ first: deckRow(0) }) },
         { match: RESERVE, respond: () => ({ changes: 1 }) },
         { match: INSERT_CARD, respond: () => ({ changes: 1 }) },
         {
            match: SELECT_CARDS_IN,
            respond: (params) => ({ all: params.slice(1).map((id) => cardRow(String(id))) }),
         },
      ];
      const db = new FakeD1(handlers);
      const created = await createCards(
         env(db),
         OWNER,
         DECK,
         Array.from({ length: MAX_CARDS_PER_BULK_CREATE }, () => card),
      );

      expect(created).toHaveLength(MAX_CARDS_PER_BULK_CREATE);
      expect(db.count(SELECT_DECK)).toBe(1);
      expect(db.count(RESERVE)).toBe(1);
      expect(db.batches).toBe(2);
   });
});

describe('import cap and batching', () => {
   const content = (rows: number) =>
      Array.from({ length: rows }, (_, index) => `front ${index},back ${index},tag`).join('\n');

   it('rejects the whole import when it would exceed the deck cap', async () => {
      const db = new FakeD1([
         { match: SELECT_DECK, respond: () => ({ first: deckRow(MAX_CARDS_PER_DECK - 1) }) },
         { match: /^SELECT id, front FROM cards/, respond: () => ({ all: [] }) },
      ]);

      await expect(
         importIntoDeck(env(db), OWNER, DECK, {
            format: 'csv',
            content: content(10),
            hasHeader: false,
            tags: [],
         }),
      ).rejects.toMatchObject({
         code: LIMIT_ERROR_CODES.cardsPerDeck,
         details: {
            limit: MAX_CARDS_PER_DECK,
            current: MAX_CARDS_PER_DECK - 1,
            requested: 10,
         },
      });
      expect(db.has(INSERT_CARD)).toBe(false);
      expect(db.has(RESERVE)).toBe(false);
   });

   it('imports 200 rows with four batches and no per-row lookups', async () => {
      const db = new FakeD1([
         { match: SELECT_DECK, respond: () => ({ first: deckRow(0) }) },
         { match: /^SELECT id, front FROM cards/, respond: () => ({ all: [] }) },
         { match: RESERVE, respond: () => ({ changes: 1 }) },
         { match: INSERT_CARD, respond: () => ({ changes: 1 }) },
         { match: /^INSERT OR IGNORE INTO card_tags/, respond: () => ({ changes: 1 }) },
      ]);

      const result = await importIntoDeck(env(db), OWNER, DECK, {
         format: 'csv',
         content: content(200),
         hasHeader: false,
         tags: [],
      });

      expect(result).toMatchObject({ imported: 200, updated: 0, skipped: 0 });
      expect(db.count(SELECT_DECK)).toBe(1);
      expect(db.count(/^SELECT id, front FROM cards/)).toBe(1);
      expect(db.batches).toBe(4);
   });

   it('updates existing fronts with one batched read and no card-by-card patch', async () => {
      const db = new FakeD1([
         { match: SELECT_DECK, respond: () => ({ first: deckRow(5) }) },
         {
            match: /^SELECT id, front FROM cards/,
            respond: () => ({ all: [{ id: 'card_existing', front: 'front 0' }] }),
         },
         { match: RESERVE, respond: () => ({ changes: 1 }) },
         { match: INSERT_CARD, respond: () => ({ changes: 1 }) },
         {
            match: SELECT_CARDS_IN,
            respond: (params) => ({ all: params.slice(1).map((id) => cardRow(String(id))) }),
         },
         { match: /^INSERT INTO card_revisions/, respond: () => ({ changes: 1 }) },
         { match: /^UPDATE cards SET/, respond: () => ({ changes: 1 }) },
         { match: /^DELETE FROM card_tags/, respond: () => ({ changes: 1 }) },
         { match: /^INSERT OR IGNORE INTO card_tags/, respond: () => ({ changes: 1 }) },
      ]);

      const result = await importIntoDeck(env(db), OWNER, DECK, {
         format: 'csv',
         content: content(2),
         hasHeader: false,
         tags: [],
      });

      expect(result).toMatchObject({ imported: 1, updated: 1 });
      expect(db.count(SELECT_DECK)).toBe(1);
      expect(db.count(/^UPDATE cards SET/)).toBe(1);
   });
});

describe('collection cap', () => {
   it('rejects creating a deck in a collection that is full', async () => {
      const db = new FakeD1([
         {
            match: /FROM collections c/,
            respond: () => ({
               first: {
                  id: 'col_full',
                  owner_id: OWNER,
                  name: 'Full',
                  position: 0,
                  deck_count: MAX_DECKS_PER_COLLECTION,
                  created_at: '2026-10-30T00:00:00.000Z',
                  updated_at: '2026-10-30T00:00:00.000Z',
                  deleted_at: null,
               },
            }),
         },
         {
            match: /^SELECT COUNT\(\*\) AS count FROM decks/,
            respond: () => ({ first: { count: MAX_DECKS_PER_COLLECTION } }),
         },
      ]);

      await expect(
         createDeck(env(db), OWNER, { title: 'Too many', collectionId: 'col_full' }),
      ).rejects.toMatchObject({
         code: LIMIT_ERROR_CODES.decksPerCollection,
         details: { limit: MAX_DECKS_PER_COLLECTION, current: MAX_DECKS_PER_COLLECTION },
      });
      expect(db.has(/^INSERT INTO decks/)).toBe(false);
   });
});
