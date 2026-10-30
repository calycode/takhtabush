/**
 * D1 cost harness (developer tool, not shipped).
 *
 * Seeds an in-memory SQLite database from `migrations/` with the workload used
 * in `docs/developer/d1-cost-model.md` (50 decks x 500 cards, 5k review events)
 * and runs the real repository/service code against it through a small D1
 * adapter. It reports:
 *
 *   - statements issued per action (exactly what D1 bills as subrequests),
 *   - rows returned to the Worker (a lower bound for rows read).
 *
 * Cloudflare bills rows *scanned*; the doc derives the scan counts from the
 * query plans printed by `--plans`. Run with:
 *
 *   pnpm d1:cost
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { AppEnv } from '../../packages/api/src/env';
import { buildMcpServices } from '../../packages/api/src/services/mcp-services';
import {
   insertCollection,
   listCollections,
   softDeleteCollection,
} from '../../packages/api/src/repositories/collections';
import { detachDecksFromCollection, updateDeck } from '../../packages/api/src/repositories/decks';
import { importIntoDeck } from '../../packages/api/src/services/import-service';
import { computeDeckStats } from '../../packages/api/src/services/stats-service';
import { listTags } from '../../packages/api/src/services/tag-service';
import {
   getSessionDetail,
   recordReview,
   startSession,
} from '../../packages/api/src/services/study-service';
import { listDeckCards } from '../../packages/api/src/services/card-service';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const DECKS = 50;
const CARDS_PER_DECK = 500;
const EVENTS = 5000;
const OWNER = 'usr_cost_harness';
const DECK_WITH_HISTORY = 'deck_cost_0001';

type Row = Record<string, unknown>;

type Result<T> = { results?: T[]; success: boolean; meta: { changes?: number } };

/** Minimal synchronous adapter exposing the subset of `D1Database` the app uses. */
class SqliteD1 {
   statements = 0;
   subrequests = 0;
   rowsReturned = 0;
   log: Array<{ sql: string; params: unknown[] }> = [];
   inBatch = false;

   constructor(readonly db: DatabaseSync) {}

   prepare(sql: string) {
      let params: unknown[] = [];
      const record = () => {
         this.statements += 1;
         if (!this.inBatch) this.subrequests += 1;
         this.log.push({ sql, params });
      };
      const api = {
         bind: (...values: unknown[]) => {
            params = values;
            return api;
         },
         first: async <T>(_column?: string) => {
            record();
            this.rowsReturned += 1;
            const row = this.db.prepare(sql).get(...(params as never[])) as T | undefined;
            return row ?? null;
         },
         all: async <T>() => {
            record();
            const results = this.db.prepare(sql).all(...(params as never[])) as T[];
            this.rowsReturned += results.length;
            return { results, success: true, meta: {} } as Result<T>;
         },
         run: async () => {
            record();
            const result = this.db.prepare(sql).run(...(params as never[]));
            return { results: [], success: true, meta: { changes: Number(result.changes) } };
         },
      };
      return api;
   }

   async batch(statements: Array<{ run: () => Promise<unknown> }>) {
      this.subrequests += 1;
      this.inBatch = true;
      const out: unknown[] = [];
      try {
         for (const statement of statements) out.push(await statement.run());
      } finally {
         this.inBatch = false;
      }
      return out;
   }

   reset() {
      this.statements = 0;
      this.subrequests = 0;
      this.rowsReturned = 0;
      this.log = [];
   }
}

/** Minimal KV double: enough for the cache service’s get/put contract. */
class MemoryKv {
   private readonly values = new Map<string, string>();

   async get(key: string): Promise<string | null> {
      return this.values.get(key) ?? null;
   }

   async put(key: string, value: string): Promise<void> {
      this.values.set(key, value);
   }
}

function applyMigrations(db: DatabaseSync) {
   const dir = path.join(ROOT, 'migrations');
   for (const file of readdirSync(dir)
      .filter((name) => name.endsWith('.sql'))
      .sort()) {
      db.exec(readFileSync(path.join(dir, file), 'utf8'));
   }
}

const iso = (offsetMs = 0) => new Date(Date.now() + offsetMs).toISOString();

function seed(db: DatabaseSync) {
   db.exec('PRAGMA foreign_keys = OFF');
   db.prepare(
      `INSERT INTO users (id, email, display_name, is_owner, created_at, updated_at)
       VALUES (?, ?, ?, 1, ?, ?)`,
   ).run(OWNER, `${OWNER}@example.test`, 'Cost Harness', iso(), iso());

   const deck = db.prepare(
      `INSERT INTO decks (id, owner_id, title, description, collection_id, visibility, card_count, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, NULL, 'private', 0, ?, ?, NULL)`,
   );
   const card = db.prepare(
      `INSERT INTO cards
         (id, deck_id, owner_id, type, front, back, cloze_text, choices_json, correct_choice,
          image_media_id, audio_media_id, tags_json, status, source, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, 'term_definition', ?, ?, NULL, NULL, NULL, NULL, NULL, ?, 'active', 'manual', ?, ?, NULL)`,
   );
   const event = db.prepare(
      `INSERT INTO review_events
         (id, session_id, card_id, user_id, response, is_correct, duration_ms, scheduler_state_json, reviewed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, '{}', ?)`,
   );
   const state = db.prepare(
      `INSERT INTO learning_state
         (user_id, card_id, deck_id, scheduler_version, state_json, due_at, interval_days, ease, repetitions, lapses, last_reviewed_at)
       VALUES (?, ?, ?, 1, '{}', ?, 1, 2.5, 1, 0, ?)`,
   );

   db.exec('BEGIN');
   for (let d = 0; d < DECKS; d += 1) {
      const deckId = `deck_cost_${String(d + 1).padStart(4, '0')}`;
      const createdAt = iso(-d * 86_400_000);
      deck.run(deckId, OWNER, `Deck ${d + 1}`, `Synthetic deck ${d + 1}`, createdAt, createdAt);
      for (let c = 0; c < CARDS_PER_DECK; c += 1) {
         const cardId = `card_cost_${String(d + 1).padStart(4, '0')}_${String(c + 1).padStart(4, '0')}`;
         card.run(
            cardId,
            deckId,
            OWNER,
            `Front ${d + 1}/${c + 1}`,
            `Back ${d + 1}/${c + 1}`,
            JSON.stringify(['synthetic', `deck-${d + 1}`]),
            createdAt,
            createdAt,
         );
      }
      db.prepare('UPDATE decks SET card_count = ? WHERE id = ?').run(CARDS_PER_DECK, deckId);
   }

   // An empty deck is the realistic target for the import scenario.
   deck.run('deck_cost_empty', OWNER, 'Empty deck', null, iso(), iso());

   // Seed the derived tag index exactly like migration 0009's backfill; the
   // app write paths maintain it afterwards.
   db.exec(`
      INSERT OR IGNORE INTO card_tags (card_id, owner_id, deck_id, tag)
      SELECT c.id, c.owner_id, c.deck_id, trim(j.value)
        FROM cards c,
             json_each(CASE WHEN json_valid(c.tags_json) THEN c.tags_json ELSE '[]' END) j
       WHERE c.deleted_at IS NULL
         AND j.type = 'text'
         AND length(trim(j.value)) > 0
   `);

   // 5,000 review events over the first deck's 500 cards (10 each), one
   // learning_state row per reviewed card, spread across the next two weeks.
   for (let i = 0; i < EVENTS; i += 1) {
      const cardIndex = (i % CARDS_PER_DECK) + 1;
      const cardId = `card_cost_0001_${String(cardIndex).padStart(4, '0')}`;
      event.run(
         `evt_cost_${String(i + 1).padStart(5, '0')}`,
         'stu_cost_seed',
         cardId,
         OWNER,
         i % 3 === 0 ? 'again' : 'good',
         i % 3 === 0 ? 0 : 1,
         1200,
         iso(-i * 3_600_000),
      );
   }
   for (let c = 1; c <= CARDS_PER_DECK; c += 1) {
      const cardId = `card_cost_0001_${String(c).padStart(4, '0')}`;
      state.run(
         OWNER,
         cardId,
         DECK_WITH_HISTORY,
         iso(c % 2 === 0 ? -86_400_000 : 5 * 86_400_000),
         iso(-3_600_000),
      );
   }
   db.prepare(
      `INSERT INTO study_sessions
         (id, user_id, deck_id, mode, strategy, planned_card_ids_json, status, started_at, completed_at, created_by)
       VALUES ('stu_cost_seed', ?, ?, 'flashcards', 'mixed', ?, 'active', ?, NULL, 'user')`,
   ).run(
      OWNER,
      DECK_WITH_HISTORY,
      JSON.stringify(
         Array.from({ length: 300 }, (_, i) => `card_cost_0001_${String(i + 1).padStart(4, '0')}`),
      ),
      iso(-3_600_000),
   );
   db.exec('COMMIT');
}

async function measure(name: string, run: () => Promise<unknown>) {
   const started = performance.now();
   const value = await run();
   const duration = Math.round(performance.now() - started);
   const db = current as SqliteD1;
   const row: Measurement = {
      action: name,
      statements: db.statements,
      subrequests: db.subrequests,
      rowsReturned: db.rowsReturned,
      durationMs: duration,
      result: summarize(value),
      queries: db.log.slice(),
   };
   db.reset();
   results.push(row);
}

function summarize(value: unknown): string {
   if (Array.isArray(value)) return `${value.length} item(s)`;
   if (value && typeof value === 'object') {
      const keys = Object.keys(value as Row);
      return keys.slice(0, 4).join(', ') + (keys.length > 4 ? ', …' : '');
   }
   return String(value);
}

type Measurement = {
   action: string;
   statements: number;
   subrequests: number;
   rowsReturned: number;
   durationMs: number;
   result: string;
   queries: Array<{ sql: string; params: unknown[] }>;
};

/**
 * The pre-0009 search SQL, kept only so `pnpm d1:cost` can report the cost the
 * new tag/FTS paths replaced. It is not imported by application code.
 */
async function legacySearchCards(
   env: AppEnv,
   opts: { ownerId: string; deckId?: string; query?: string; tag?: string; limit: number },
) {
   const now = iso();
   const params: unknown[] = [now, opts.ownerId, opts.ownerId];
   let where = 'c.owner_id = ? AND c.deleted_at IS NULL';
   if (opts.deckId) {
      where += ' AND c.deck_id = ?';
      params.push(opts.deckId);
   }
   if (opts.query) {
      where += ' AND c.front LIKE ?';
      params.push(`%${opts.query}%`);
   }
   if (opts.tag) {
      where += ' AND c.tags_json LIKE ?';
      params.push(`%"${opts.tag}"%`);
   }
   const inner = `SELECT c.*, CASE
         WHEN c.status = 'suspended' THEN 'suspended'
         WHEN ls.card_id IS NULL THEN 'new'
         WHEN ls.due_at IS NOT NULL AND ls.due_at <= ? THEN 'due'
         ELSE 'scheduled'
       END AS due_state
      FROM cards c
      LEFT JOIN learning_state ls ON ls.card_id = c.id AND ls.user_id = ?
      WHERE ${where}`;
   return env.DB.prepare(
      `SELECT * FROM (${inner}) t WHERE 1=1 ORDER BY updated_at DESC, id DESC LIMIT ?`,
   )
      .bind(...params, opts.limit + 1)
      .all<Row>();
}

const results: Measurement[] = [];
let current: SqliteD1;

async function main() {
   const sqlite = new DatabaseSync(':memory:');
   applyMigrations(sqlite);
   seed(sqlite);

   const d1 = new SqliteD1(sqlite);
   current = d1;
   const env = {
      DB: d1,
      MEDIA: {},
      AI: undefined,
      ASSETS: {},
      APP_URL: 'http://localhost:8787',
      SESSION_SECRET: 'cost-harness',
      EMAIL_FROM: 'no-reply@test.local',
      ENVIRONMENT: 'development',
      AI_GATEWAY_URL: '',
      CLEF_MODEL: 'none',
   } as unknown as AppEnv;
   const user: Parameters<typeof buildMcpServices>[1] = {
      id: OWNER,
      email: `${OWNER}@example.test`,
      displayName: 'Cost Harness',
      isOwner: true,
      createdAt: iso(),
      updatedAt: iso(),
   };
   const services = buildMcpServices(env, user, null, 'http://localhost:8787');
   const cachedEnv = {
      ...env,
      CACHE: new MemoryKv() as unknown as KVNamespace,
   } as AppEnv;

   const importContent = Array.from(
      { length: 200 },
      (_, i) => `new front ${i},new back ${i},imported`,
   ).join('\n');

   d1.reset();
   await measure('list_decks (MCP, page of 20)', () => services.listDecks({ limit: 20 }));
   await measure('get_deck detail', () =>
      services.getDeck({ id: DECK_WITH_HISTORY, includeCards: false, limit: 20 }),
   );
   await measure('card list (deck detail, page of 20)', () =>
      listDeckCards(env, OWNER, DECK_WITH_HISTORY, { limit: 20 }),
   );
   await measure('search_cards (query, page of 20)', () =>
      services.searchCards({
         limit: 20,
         cursor: undefined,
         deckId: DECK_WITH_HISTORY,
         query: 'Front 1',
         tag: undefined,
         due: undefined,
      }),
   );
   await measure('search_cards (tag — legacy tags_json LIKE)', () =>
      legacySearchCards(env, { ownerId: OWNER, tag: 'deck-1', limit: 20 }),
   );
   await measure('search_cards (tag — card_tags index)', () =>
      services.searchCards({
         limit: 20,
         cursor: undefined,
         deckId: undefined,
         query: undefined,
         tag: 'deck-1',
         due: undefined,
      }),
   );
   await measure('search_cards (text — legacy LIKE)', () =>
      legacySearchCards(env, { ownerId: OWNER, query: '23/456', limit: 20 }),
   );
   await measure('search_cards (text — trigram FTS)', () =>
      services.searchCards({
         limit: 20,
         cursor: undefined,
         deckId: undefined,
         query: '23/456',
         tag: undefined,
         due: undefined,
      }),
   );
   await measure('list_tags (global, cold compute)', () => listTags(env, OWNER));
   await listTags(cachedEnv, OWNER);
   d1.reset();
   await measure('list_tags (global, cache warm)', () => listTags(cachedEnv, OWNER));
   await measure('start_session (learn, 15 min)', () =>
      startSession(
         env,
         OWNER,
         { deckId: DECK_WITH_HISTORY, mode: 'flashcards', goal: 'learn', minutes: 15 },
         'user',
      ),
   );
   const started = await startSession(
      env,
      OWNER,
      { deckId: DECK_WITH_HISTORY, mode: 'flashcards', goal: 'learn', minutes: 15 },
      'user',
   );
   const reviewCardId = started.plan.cardIds[0]!;
   d1.reset();
   await measure('record_review', () =>
      recordReview(env, OWNER, started.session.id, {
         cardId: reviewCardId,
         response: 'good',
         durationMs: 1500,
      }),
   );
   await measure('get_study_session (300 planned cards)', () =>
      services.getStudySession('stu_cost_seed'),
   );
   await measure('get_session detail (resume)', () =>
      getSessionDetail(env, OWNER, 'stu_cost_seed'),
   );
   await measure('import 200 new rows', () =>
      importIntoDeck(env, OWNER, 'deck_cost_empty', {
         format: 'csv',
         content: importContent,
         hasHeader: false,
         tags: [],
         delimiter: ',',
         tagSeparator: ';',
      }),
   );
   const importedTags = sqlite
      .prepare("SELECT COUNT(*) AS count FROM card_tags WHERE deck_id = 'deck_cost_empty'")
      .get() as { count: number };
   if (Number(importedTags.count) !== 200) {
      throw new Error(
         `Import did not maintain card_tags (expected 200, got ${importedTags.count})`,
      );
   }
   const importedFts = sqlite
      .prepare(
         'SELECT COUNT(*) AS count FROM cards_fts WHERE cards_fts MATCH \'front : "new front 0"\'',
      )
      .get() as { count: number };
   if (Number(importedFts.count) !== 1) {
      throw new Error(`Import did not maintain cards_fts (got ${importedFts.count} matches)`);
   }
   await measure('deck stats', () => computeDeckStats(env, OWNER, DECK_WITH_HISTORY));
   await computeDeckStats(cachedEnv, OWNER, DECK_WITH_HISTORY);
   d1.reset();
   await measure('deck stats (streak cache warm)', () =>
      computeDeckStats(cachedEnv, OWNER, DECK_WITH_HISTORY),
   );

   await measure('collection lifecycle', async () => {
      const collection = await insertCollection(env, { ownerId: OWNER, name: 'Spanish' });
      await updateDeck(env, 'deck_cost_0002', { collectionId: collection.id });
      const listed = await listCollections(env, OWNER);
      if (listed.find((item) => item.id === collection.id)?.deckCount !== 1) {
         throw new Error('Collection deck count was not 1');
      }
      await detachDecksFromCollection(env, OWNER, collection.id);
      await softDeleteCollection(env, collection.id);
      if ((await listCollections(env, OWNER)).length !== 0) {
         throw new Error('Collection was not removed');
      }
      return { collection: collection.name };
   });

   console.table(
      results.map(({ action, statements, subrequests, rowsReturned, durationMs }) => ({
         action,
         statements,
         subrequests,
         rowsReturned,
         durationMs,
      })),
   );

   if (process.argv.includes('--plans')) {
      for (const row of results) {
         if (
            ![
               'start_session (learn, 15 min)',
               'get_study_session (300 planned cards)',
               'deck stats',
               'search_cards (tag — legacy tags_json LIKE)',
               'search_cards (tag — card_tags index)',
               'search_cards (text — legacy LIKE)',
               'search_cards (text — trigram FTS)',
               'list_tags (global, cold compute)',
            ].includes(row.action)
         ) {
            continue;
         }
         console.log(`\n# ${row.action}`);
         for (const query of row.queries.slice(0, 8)) {
            const plan = sqlite
               .prepare(`EXPLAIN QUERY PLAN ${query.sql}`)
               .all(...(query.params as never[])) as Array<{ detail: string }>;
            console.log(`- ${query.sql.replace(/\s+/g, ' ').slice(0, 110)}`);
            console.log(`  ${plan.map((entry) => entry.detail).join(' | ')}`);
         }
      }
   }
}

main().catch((error) => {
   console.error(error);
   process.exitCode = 1;
});
