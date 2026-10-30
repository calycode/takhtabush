# D1 cost model

Takhtabush keeps every structured row in one D1 database. D1 bills **rows
scanned and rows written**, not requests or bytes, and one database is
single-threaded. That makes an accidental per-row query loop expensive twice: it
spends the daily read budget and it serializes the whole database.

This page records the current limits, the measured cost of each endpoint at a
realistic size, every query-per-row loop the audit found, and the caps that keep
the numbers bounded. It is the reference for `packages/shared/src/domain/limits.ts`.

Revision 13 adds three targeted changes on top of that model: a derived
`card_tags` index for tag filters, a trigram FTS5 index for owner-wide front
search, and a Workers KV cache for two derived reads (review streak and the
global tag summary). It also merges the two per-request auth queries into one.
The measured table in §3 now reports the before/after for each.

## 1. What D1 bills and where the limits are

Facts below come from the Cloudflare D1 docs, checked on **2026-10-30**:

- [Limits](https://developers.cloudflare.com/d1/platform/limits/) — page last updated 2026-10-24.
- [Pricing](https://developers.cloudflare.com/d1/platform/pricing/) — page last updated 2026-04-21.

| Fact                                  | Workers Paid                                               | Workers Free  | Why it matters here                                                                                          |
| ------------------------------------- | ---------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------ |
| Maximum database size                 | 10 GB                                                      | 500 MB        | One DB for the whole deployment; cannot be raised.                                                           |
| Storage per account                   | 1 TB                                                       | 5 GB          | Storage is not the constraint for this workload (see §5).                                                    |
| Rows read                             | First 25 billion/month included, then **$0.001 / million** | 5 million/day | The binding budget. A full scan of 25k cards costs 25k rows.                                                 |
| Rows written                          | First 50 million/month included, then **$1.00 / million**  | 100,000/day   | Each insert also writes its indexes; importing 500 cards writes ~2,500 index entries.                        |
| Storage                               | First 5 GB included, then $0.75 / GB-month                 | 5 GB total    | Irrelevant until ~100× today's data.                                                                         |
| Queries per Worker invocation         | 1,000                                                      | 50            | A per-row loop can exhaust this before it exhausts rows. `db.batch()` counts as **one** query.               |
| Maximum bound parameters per query    | 100                                                        | 100           | Every `WHERE id IN (…)` is chunked below this (see `lib/d1.ts`).                                             |
| Maximum SQL statement length          | 100 KB                                                     | 100 KB        | Import content is capped at 1 MB but each insert is a separate statement.                                    |
| Maximum row / string / BLOB           | 2 MB                                                       | 2 MB          | Card text is limited to 2,000 + 5,000 chars, far below.                                                      |
| `LIKE` / `GLOB` pattern               | 50 bytes                                                   | 50 bytes      | The search box sends at most 200 chars; the pattern is truncated by D1, so long queries silently match less. |
| Query duration                        | 30 s                                                       | 30 s          | Report-level aggregates must stay index-driven.                                                              |
| Concurrent connections per invocation | 6                                                          | 6             | Parallel batches still serialize inside one database.                                                        |

Two definitions matter for everything below:

- **Rows read** counts rows _examined_, including index entries, regardless of
  how many rows are returned or how large they are.
- **Rows written** counts rows written to the table **and** to each index whose
  columns changed. Adding an index raises write cost; it must remove more reads
  than it adds writes.

One D1 database is a single Durable Object: queries run one at a time. At 1 ms
per read, one database tops out near 1,000 queries/second, and a 100 ms query
drops that to 10/second. Cloudflare's own advice is to reduce the number of
requests, then use `batch()` so per-request overhead is paid once.

## 2. Workload and method

The model uses one owner with:

- **50 decks × 500 cards** = 25,000 cards (the per-deck cap, §8).
- **5,000 review events** spread evenly: 100 events per deck over 100 distinct
  cards, so `learning_state` also holds 5,000 rows (100 per deck).
- 20-deck / 20-card pages, the API defaults.
- Every request pays one fixed auth query (`sessions JOIN users`, one row). It
  was two queries and two rows before Revision 13; see §4.

Numbers were produced by `scripts/d1-cost/measure.ts` (`pnpm d1:cost`). The
harness applies `migrations/` to an in-memory SQLite database, seeds the workload
above, and calls the **real repositories and services** through a small `D1Database`
adapter. It reports:

- **subrequests** — statements issued, with a `db.batch()` counted once (this is
  what D1's per-invocation limit and per-request overhead care about),
- **rows returned** — exact,
- **rows read** — modelled from `EXPLAIN QUERY PLAN` on the seeded database plus
  the known table sizes. Run `pnpm d1:cost:plans` to print the plan for every
  hot statement.

The harness is a development tool. It is not part of the Worker bundle and is not
run in CI.

## 3. Measured results

"Before" is commit `2792514`; "after" is this change. Rows read are per request,
modelled at the workload in §2.

| Action                            | Before subrequests | Before rows read | After subrequests | After rows read | Main change                                                    |
| --------------------------------- | -----------------: | ---------------: | ----------------: | --------------: | -------------------------------------------------------------- |
| `list_decks` (MCP, page of 20)    |                  2 |           ≈5,021 |                 2 |          ≈2,021 | Due counts scoped to the page, `learning_state.deck_id`        |
| Deck detail                       |                  1 |                1 |                 1 |               1 | —                                                              |
| Card list (page of 20)            |                  2 |               22 |                 2 |              22 | Keyset index now covers the `id` tie-break                     |
| `search_cards` (deck-scoped text) |                  1 |              501 |                 1 |             501 | FTS is owner-wide; a deck is already capped at 500 cards (§12) |
| `search_cards` (tag filter)       |                  1 |          ≈50,000 |                 1 |          ≈1,500 | `card_tags` covering index drives instead of a card scan (§12) |
| `search_cards` (owner-wide text)  |                  1 |          ≈50,000 |                 1 |    ≈matches + 2 | Trigram FTS5 drives instead of a `LIKE` scan (§12)             |
| Start session (learn)             |                  6 |          ≈10,020 |                 6 |            ≈720 | Deck-first weak aggregate, deck-scoped due queue               |
| Record review                     |                  7 |             ≈205 |                 7 |            ≈205 | `COUNT(DISTINCT)` instead of materializing ids                 |
| `get_study_session` (300 cards)   |            **303** |             ≈603 |             **7** |            ≈603 | One chunked `IN (…)` read per 90 ids                           |
| Session detail (resume)           |                  2 |             ≈501 |                 2 |            ≈501 | —                                                              |
| Import 200 new rows               |            **802** |         ≈101,000 |             **7** |            ≈501 | Batched inserts, one slot reservation, no recount              |
| Deck stats                        |                  7 |          ≈25,600 |                 7 |          ≈6,900 | Three deck-scoped reads replace whole-library scans            |
| Deck stats (streak cache hit)     |                  — |                — |                 6 |    removes scan | One KV read replaces the bounded streak read (§11)             |
| Auth (every request)              |                  2 |                2 |                 1 |               1 | `sessions JOIN users` (§4, item 12)                            |

The two large numbers before the change are real: the harness measured 303
statements for a 300-card snapshot and 802 for a 200-row import. The 1,000-query
paid limit is close for imports; the 50-query free limit is already exceeded by a
25-row import.

The harness measured the new paths directly:

- **Tag filter:** one statement, 21 rows returned (the page plus one probe) in
  both variants. The plan changed from a `idx_cards_owner` search over 25,000
  cards plus 25,000 `learning_state` probes to a covering
  `idx_card_tags_owner_tag` search plus one primary-key probe per matching card.
  At two tags per card, `card_tags` holds 50,000 rows, but the index read is the
  500 rows for `deck-1`, not the whole table.
- **Owner-wide text:** one statement, one row returned. The plan scans the FTS
  virtual table and probes `cards` by primary key per match, instead of scanning
  the owner's card index range with `LIKE`. A query that matches everything still
  costs proportional to the matches; FTS removes the _non-matching_ scan, not the
  cost of a broad query.
- **Deck-scoped text:** deliberately left on `LIKE` (one statement, 21 rows
  returned). The deck cap already bounds it to 500 cards; a cross-deck FTS probe
  would be more work, not less.
- **Global tags:** cold compute is one statement and 25,000 rows returned; a
  cache hit is 0 D1 statements and 0 rows (one KV read). See §11.
- **Deck stats:** 7 statements / 474 rows returned cold, 6 / 265 with a warm
  streak cache. The 209-row difference is the streak query's distinct review
  days; the query scans ~5,000 events to produce them.
- **Auth:** one statement and one row per request instead of two and two.

Deck stats varies with how many state rows are due or upcoming; the ≈25,600
figure above assumes all 5,000 state rows are, which is the worst case for the two
pre-change due reads.

`get_study_session` now costs `3 + ceil(plannedCards / 90)` subrequests: 4 at
five cards, 7 at 300, 9 at the 500-card cap. The old version cost
`3 + plannedCards`.

### What a day of use costs

At the free tier's 5 million rows/day:

| Action                    | Runs/day before |                        Runs/day after |
| ------------------------- | --------------: | ------------------------------------: |
| Start a session           |            ~499 |                                ~6,944 |
| Resume a 300-card session |          ~8,291 | ~8,291 (same rows, far fewer queries) |
| Import 200 cards          |             ~49 |                                ~9,980 |
| Load deck stats           |            ~195 |                                  ~725 |

At paid rates the same actions cost fractions of a cent per thousand calls:
10,020 rows is $0.00001. **The problem was never the invoice; it was the free-tier
ceiling and the per-invocation query cap.**

## 4. N+1 and nested-lookup inventory

Every place the audit found a query (or a scan) per row:

| #   | Location                                                                        | Pattern                                                                                                                                  | Status                                                                                                                           |
| --- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `services/mcp-services.ts` `getStudySession`                                    | `for (cardId of plannedCardIds) getCardRow(...)` — one query per card                                                                    | **Fixed**: `getCardRowsByIds` chunks 90 ids per statement                                                                        |
| 2   | `services/import-service.ts`                                                    | Per row: `createCard` (deck read, insert, select, full `card_count` recount) or `patchCard` (card read, revision insert, update, select) | **Fixed**: batched inserts, batched revision+update, one reservation                                                             |
| 3   | `services/mcp-services.ts` `createCards`                                        | `Promise.all(cards.map(createCard))` — 4 statements per card                                                                             | **Fixed**: bulk service, one reservation, `db.batch()` inserts                                                                   |
| 4   | `repositories/decks.ts` `recalcCardCount`                                       | `COUNT(*)` over the whole deck after **every** card write; O(deck) rows read per write                                                   | **Fixed**: atomic `card_count` reservation/decrement                                                                             |
| 5   | `repositories/maintenance.ts` `deleteMediaRows`                                 | `DELETE` per media id (up to 200 per run)                                                                                                | **Fixed**: chunked `DELETE … WHERE id IN (…)`                                                                                    |
| 6   | `repositories/maintenance.ts` `selectOrphanedMedia`                             | `NOT EXISTS (… OR image_media_id = ? OR audio_media_id = ?)` had no usable index; plan showed `SCAN c` **per media row**                 | **Fixed**: partial indexes on both media columns (plan is now `MULTI-INDEX OR`)                                                  |
| 7   | `repositories/study.ts` `listWeakCardIds`, `getWeakCards`, `getReviewAggregate` | Join started from `review_events`, so each deck's stat scanned **every event the user ever recorded**                                    | **Fixed**: `CROSS JOIN` forces the deck's cards to drive; one index probe per card                                               |
| 8   | `repositories/study.ts` `getReviewStreak`                                       | Scanned all review events to build the day set                                                                                           | **Cached**: KV read-through with a 10-minute TTL; the bounded 400-day scan runs on a miss (§11)                                  |
| 9   | `repositories/study.ts` `deckDueCounts`                                         | Whole-owner due aggregate for a 20-deck MCP page                                                                                         | **Fixed**: page deck ids + `learning_state.deck_id` index                                                                        |
| 10  | `services/tag-service.ts` → `listOwnedTagStrings`                               | Read every card's `tags_json` for suggestions                                                                                            | **Split**: deck-scoped stays capped and uncached; the global summary is cached in KV (§11). Tag filtering uses `card_tags` (§12) |
| 11  | `routes/decks.ts` export                                                        | `SELECT *` for every live card                                                                                                           | **Bounded** by the 500-card cap; one query                                                                                       |
| 12  | `middleware/auth.ts`                                                            | Session + user lookup on every request                                                                                                   | **Fixed**: one `sessions JOIN users` query, one row (§4)                                                                         |

No loop remains in the audited paths. `getStudySession`, import, bulk create,
cleanup, and the MCP list all issue a fixed number of statements, or one
per 90/50-row chunk in the two paths where the input itself is bounded by a cap.
R2 object deletion in the cron stays one call per object because R2 has no batch
delete; the daily batch is capped at `CLEANUP_RETENTION.mediaBatchSize` (200).

## 5. Storage and writes

At ~0.7 KB per card, ~0.5 KB per review event, and index overhead:

- 25,000 cards ≈ 18 MB
- 5,000 events + 5,000 learning-state rows ≈ 5 MB
- ~20 indexes ≈ 15 MB
- **Total ≈ 38 MB** — 0.8% of the 5 GB included storage, 0.4% of one 10 GB database.

Storage holds ~300 copies of this workload before the database ceiling matters.
Writes are dominated by imports and review recording:

- One review writes 1 event + 1 state row + their index entries (~8 rows).
- One imported card writes 1 row + 6 index entries (~7 rows).
- `card_tags` adds one row + two index entries per tag (~3 rows/tag). At the
  two-tag average in the harness that is ~6 more rows per card.
- The FTS trigger writes the trigram shadow index. The harness proxy measured a
  `total_changes` delta of ~6 extra logical rows for a ~490-character card; that
  is a lower bound, because FTS5 stores term data in shadow B-trees rather than
  one row per term.
- A card with two tags therefore costs roughly 19 rows written instead of 7.
  A 500-card import with two tags writes ~9,500 rows, so the free 100k/day
  budget allows about ten such imports per day. The 500-card cap is what keeps
  this bounded; a larger import would multiply the tag and FTS writes linearly.
- The free write budget (100k/day) allows ~28,000 reviews/day or ~10 imports of
  500 tagged cards.

## 6. Index inventory

Existing before this change (`0002`, `0003`–`0007`):

| Index                                                       | Serves                             |
| ----------------------------------------------------------- | ---------------------------------- |
| `decks(owner_id, deleted_at, updated_at DESC)`              | Deck list                          |
| `cards(deck_id, deleted_at, updated_at DESC)`               | Card list, deck aggregates         |
| `cards(owner_id, deleted_at)`                               | MCP search, tag scan               |
| `review_events(user_id, card_id, reviewed_at DESC)`         | Per-card history, weak-card probes |
| `review_events(session_id, reviewed_at)`                    | Session reviews                    |
| `learning_state(user_id, due_at)`                           | Global due queue                   |
| `learning_state` PK `(user_id, card_id)`                    | State lookup/upsert                |
| `decks(owner_id, folder_id, deleted_at)`                    | (Unused folder prototype)          |
| `study_sessions(user_id, deck_id, status)`                  | Session lifecycle                  |
| `media_objects(owner_id, status, created_at DESC)`          | Media library                      |
| `ai_evaluations(subject_type, subject_id, created_at DESC)` | Evaluation cache                   |

Missing, and added in `0008_collections_and_limits.sql`:

| New index                                                              | Removes                                                   |
| ---------------------------------------------------------------------- | --------------------------------------------------------- |
| `decks(owner_id, deleted_at, updated_at DESC, id DESC)`                | Keyset tie-break temp b-tree; replaces the 3-column index |
| `cards(deck_id, deleted_at, updated_at DESC, id DESC)`                 | Keyset tie-break temp b-tree; replaces the 3-column index |
| `collections(owner_id, deleted_at, position, name)`                    | Collection list sort                                      |
| `decks(owner_id, collection_id, deleted_at, updated_at DESC, id DESC)` | Deck list filtered by collection                          |
| `study_sessions(user_id, started_at DESC)`                             | Session list                                              |
| `study_sessions(user_id, status, started_at DESC)`                     | Active-session list                                       |
| `review_events(user_id, reviewed_at DESC)`                             | Streak window, review aggregates                          |
| `review_events(card_id)`                                               | Cleanup of purged cards                                   |
| `review_events(session_id, card_id)`                                   | `COUNT(DISTINCT card_id)` per session                     |
| `card_revisions(card_id)`                                              | Cleanup                                                   |
| `learning_state(card_id)`                                              | Cleanup                                                   |
| `learning_state(user_id, deck_id, due_at)`                             | Deck-scoped due counts/queue/forecast                     |
| `cards(image_media_id)` partial                                        | Orphan-media check                                        |
| `cards(audio_media_id)` partial                                        | Orphan-media check                                        |

Still missing, deliberately:

- **A deck id inside `review_events`.** Stats are already deck-scoped through the
  cards join; adding `deck_id` there would remove the join but add a column to
  the append-only table, which is not worth it.

Added in `0009_card_tags_and_fts.sql`:

| New index / table                                               | Serves                                                        |
| --------------------------------------------------------------- | ------------------------------------------------------------- |
| `card_tags` PK `(card_id, tag)`                                 | Replace/delete one card's tags; hard-delete cleanup           |
| `idx_card_tags_owner_tag(owner_id, tag, card_id)`               | `search_cards?tag=` (covering index, then primary-key probes) |
| `idx_card_tags_owner_deck_tag(owner_id, deck_id, tag, card_id)` | Deck-scoped tag filter/count variant                          |
| `cards_fts` FTS5 (trigram) on `cards(front, back)`              | Owner-wide front search (`MATCH` + primary-key probes)        |

`card_tags.tag` is `COLLATE NOCASE`, so the index keeps the old `LIKE`
case-insensitivity. `cards_fts` is an external-content table kept in sync by
three triggers (`AFTER INSERT`, `AFTER DELETE`, `AFTER UPDATE OF front, back`)
and backfilled with `INSERT INTO cards_fts(cards_fts) VALUES ('rebuild')`.

## 7. Follow-ups from the first audit, and what remains

The first audit listed six rewrites. Revision 13 landed the first four; the last
two stay as recommendations.

1. **`card_tags` table — done.** One row per `(card, tag)`, maintained by the
   card write paths and used by tag filters (§12).
2. **FTS5 for `search_cards` — done, with a scope limit.** Owner-wide front
   search uses a trigram FTS5 table; deck-scoped search stays on `LIKE` because
   the 500-card cap already bounds it (§12).
3. **Cache the streak — done.** Workers KV read-through with a 10-minute TTL
   (§11), not a `stats_cache` D1 row.
4. **Merge the two auth queries — done.** One `sessions JOIN users` query per
   request (§4).
5. **Read replication.** D1 replicas do not reduce rows-read billing, but they
   remove the single-writer queue for read-heavy pages. Not needed at this size.
6. **A `SELECT` projection for MCP summaries.** Rows read is unaffected, but
   not serializing 5 KB `back` fields would cut Worker CPU on list endpoints.

## 8. The caps and why these numbers

`packages/shared/src/domain/limits.ts` is the single source of truth; API Zod
schemas, MCP schemas, the web app, and the service guards all read it.

| Limit                   |   Value | Reasoning                                                                                                                                                                                                                                                                                                      |
| ----------------------- | ------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cards per deck          | **500** | One deck equals one study plan's candidate ceiling (`listWeakCardIds(500)`, `listActiveCardIds(500)`, `cardIds.max(500)`). A 500-card snapshot is 6 chunked reads + 3 fixed = 9 subrequests; 1,000 would double that and double every per-deck aggregate. At 500, a 20-deck page stays under 10,000 card rows. |
| Cards per bulk create   |     100 | 2 insert batches + 2 read-back chunks; keeps one MCP call to ~6 subrequests.                                                                                                                                                                                                                                   |
| Import rows per request |     500 | Matches the deck cap, so a full deck can arrive in one request: 10 batches of 50 inserts. Lowered from 2,000, which could never fit in one deck anyway.                                                                                                                                                        |
| Import bytes            |    1 MB | Existing spec limit; also keeps the request validation cost bounded.                                                                                                                                                                                                                                           |
| Tags per card           |      20 | Existing; each tag is inside `tags_json`, so this bounds the JSON column.                                                                                                                                                                                                                                      |
| Tag length              |      40 | Existing; fits a tag chip and bounds one `card_tags` row. The old `LIKE`-pattern limit no longer applies (§12).                                                                                                                                                                                                |
| Decks per collection    |     200 | 200 decks × 500 cards is already 100k cards — far past what a single-tenant library needs; the cap exists so a collection page cannot grow unbounded.                                                                                                                                                          |
| Collections per user    |     100 | The collection list is intentionally not paginated; 100 keeps one query under 100 rows.                                                                                                                                                                                                                        |
| Collection name         |      80 | Fits the sidebar without truncation.                                                                                                                                                                                                                                                                           |

Why not 1,000 cards? A 1,000-card deck means a 1,000-id snapshot (12 reads), a
1,000-row stats/tag/export read per deck, and a 1,000-row import (20 batches).
More importantly, the planner's candidate window is 500: a deck larger than that
cannot be planned in one pass, so the extra cards are invisible to a normal
session and only inflate every aggregate.

### Enforcement

The cap is enforced by a **conditional reservation**, not by trusting the client:

```sql
UPDATE decks SET card_count = card_count + ?, updated_at = ?
 WHERE id = ? AND deleted_at IS NULL AND card_count + ? <= 500
```

`meta.changes === 0` means the deck is full; the service throws
`DECK_CARD_LIMIT_EXCEEDED` (HTTP 409) with `{ limit, current, requested, deckId }`
in the standard error envelope. Because D1 serializes writes per database, two
concurrent creates cannot oversell a deck. A failed insert releases the reserved
slots. Every write path goes through it:

- `POST /decks/:id/cards` → `createCard`
- MCP `create_cards` → `createCards` (batch reservation)
- `POST /decks/:id/import` → whole-import pre-check + reservation
- `POST /cards/:id/restore` → reservation before undeleting
- `DELETE /cards/:id` → `MAX(card_count - 1, 0)`

`decks.card_count` is recomputed once in the migration. Existing decks above 500
stay readable and studyable, but cannot accept new cards until they shrink.

## 9. Collections instead of moving tags out of decks

Tags and collections answer different questions:

- A **tag** describes a card's content. It is many-to-many, changes with the
  card, and is read on every card row.
- A **collection** describes where a deck lives. It is one nullable pointer per
  deck, changes rarely, and is read only by the deck library.

Moving tag organisation out of decks would mean a join on every card read and an
extra write per tag, to solve an organisation problem that is really about decks.
The derived `card_tags` table (§12) does not change that: `cards.tags_json`
remains the display source, and `card_tags` exists only to make tag filters
indexable. Collections add **one nullable column to `decks`** and zero joins to
card reads.

The design is deliberately flat:

- `collections(id, owner_id, name, position, created_at, updated_at, deleted_at)`
  — prefixed `col_` ids, owner-scoped.
- `decks.collection_id TEXT REFERENCES collections(id) ON DELETE SET NULL` —
  deleting a collection never deletes a deck. The API also detaches decks on
  soft delete, so the UI never shows a deck pointing at a hidden collection.
- `position` orders the sidebar; decks are ordered by `updated_at` inside a
  collection, using `idx_decks_collection`.
- `0010_collection_positions.sql` gives every pre-existing collection a distinct
  position (0008 added the column with a default of 0), so the deck library's
  up/down swap is not a no-op on legacy data.
- One query lists every collection with its deck count: a `LEFT JOIN` +
  `GROUP BY`, not a correlated subquery per row.

Why not nested trees: a two-level tree needs a recursive CTE (or a parent walk)
to render one sidebar, and every ancestor change can move a subtree. Deletions,
ordering, and deck counts all become recursive. The read cost is small at 100
collections, but the invariant cost is not. Flat collections cover the actual
use case — grouping decks — and keep the deck list one indexed query.

Out of scope by design: public/shared collections, marketplace semantics,
multi-level nesting, per-collection permissions, and drag-and-drop reordering in
the UI (`position` is exposed by the API and can be set from the client).

## 10. Reproducing

```bash
pnpm d1:cost          # statements / subrequests / rows returned, incl. tag, FTS, and cache paths
pnpm d1:cost:plans    # same, plus EXPLAIN QUERY PLAN for session/stats/search/tags
pnpm db:migrate:local # verify the migrations apply to a real D1
```

The harness needs Node's built-in `node:sqlite` (Node 22.5+, unflagged from Node
23.4). It never touches `wrangler` state, remote D1, or production.

## 11. Workers KV cache

Two derived reads moved to Workers KV. The namespace is `CACHE`, separate from
`OAUTH_KV`: auth grants and cache have different safety rules, and a cache flush
must never be able to revoke a grant.

Facts below come from the Cloudflare KV docs, checked on **2026-10-30**:

- [Limits](https://developers.cloudflare.com/kv/platform/limits/)
- [Pricing](https://developers.cloudflare.com/kv/platform/pricing/)

| Fact                   | Free          | Paid                               |
| ---------------------- | ------------- | ---------------------------------- |
| Reads                  | 100,000 / day | 10M/month included, then $0.50/M   |
| Writes                 | 1,000 / day   | 1M/month included, then $5.00/M    |
| Writes to the same key | 1 / second    | 1 / second                         |
| Stored data            | 1 GB          | 1 GB included, then $0.50/GB-month |
| Value size             | 25 MiB        | 25 MiB                             |
| Consistency            | Eventual      | Eventual                           |

### Why KV when D1 rows are cheaper per unit

D1 rows are cheaper per unit than KV operations, and this cache is not primarily
a bill-reduction move. It buys three things:

1. **Edge latency.** A KV read is served near the request; it does not enter the
   single D1 database's queue.
2. **The D1 single-writer queue.** One database processes queries one at a time.
   A stats page that waits behind an import delays every other request. Removing
   the streak and tag aggregates from that queue helps more than their row count
   suggests.
3. **The free-tier rows budget.** The global tag summary scans 25,000 card rows
   at the modeled workload. Five million rows/day is the binding free-tier
   budget, and a 5-minute cache turns repeated reads into one scan per window.

### Policy

| Value              | Key                        | TTL    | Why stale is safe                                                        |
| ------------------ | -------------------------- | ------ | ------------------------------------------------------------------------ |
| Review streak      | `cache:v1:streak:<userId>` | 10 min | It changes at most once per day; a stale value is the same day's streak. |
| Global tag summary | `cache:v1:tags:<userId>`   | 5 min  | It only feeds autocomplete; a new tag may take one window to suggest.    |

Rules:

- Cache **only derived, stale-tolerant data**. Never cache auth, sessions,
  ownership, card or deck rows, due counts, or anything a write must invalidate
  immediately.
- Never invalidate on a review or a card write. The TTL is the invalidation
  policy; KV allows only one write per second per key.
- Values are JSON, stored with `expirationTtl`, and validated on read. A
  malformed value is a miss.
- Keys are namespaced and versioned (`cache:v1:…`), so a shape change can move to
  `v2` without flushing the namespace.
- **Fail open.** A missing binding, a KV read/write error, or malformed JSON
  falls back to the D1 computation. A KV failure must never fail a request.
- Never use KV for authorization; it is eventually consistent.

### Measured

`pnpm d1:cost` includes a cold and a warm path for both values:

| Action                          | D1 statements | D1 rows returned |
| ------------------------------- | ------------: | ---------------: |
| `list_tags` (global, cold)      |             1 |           25,000 |
| `list_tags` (global, cache hit) |             0 |                0 |
| Deck stats (cold streak)        |             7 |              474 |
| Deck stats (warm streak)        |             6 |              265 |

The warm streak path removes the bounded 400-day `review_events` read (5,000
events across ~209 distinct days in the harness). The tag cache hit removes the
card scan entirely; it still costs one KV read, which is not D1 work.

### Provisioning

`CACHE` is declared in both `wrangler.jsonc` and `wrangler.dev.jsonc` with no
namespace id, matching `OAUTH_KV`: Appflare and Cloudflare's Deploy button
provision it from the binding name. A manual deployment must either let Wrangler
provision it or add the real id first. Deployments without the binding still
work — the helpers recompute from D1 — but they do not get the cache.

## 12. Tag index and FTS5 search

### `card_tags`

`cards.tags_json` stays the source of truth for display. `card_tags` is a
derived projection with one row per `(card, tag)` plus `owner_id` and `deck_id`
columns; `tag COLLATE NOCASE` preserves the old `LIKE` case-insensitivity. It is
maintained in the same `db.batch()` as the card write, never in a query-per-row
loop:

- **Create:** card insert + one `INSERT OR IGNORE` for its tags.
- **Bulk create / import:** card inserts and tag inserts share the batch.
- **Update:** replace the card's tag rows (delete + insert) when `tags` changes.
- **Restore:** re-insert the tags from `tags_json` in the restore batch.
- **Soft delete:** delete the card's tag rows in the same batch.
- **Hard cleanup:** `pruneDeletedCards` deletes `card_tags` before the card row.

Tag search now drives from `idx_card_tags_owner_tag` and probes `cards` by
primary key. Global tag counts deliberately stay on the card scan: at two tags
per card, `card_tags` would read 50,000 index rows to count tags where the card
scan reads 25,000 rows, so `card_tags` would be more expensive for that one
aggregate. The global summary is cached (§11); deck-scoped suggestions stay on
the 500-card-bounded scan and are not cached.

Migration `0009` backfills the table with `json_each` while
`cards.deleted_at IS NULL`, so soft-deleted cards never enter tag results. The
`json_valid` guard means a malformed legacy `tags_json` contributes no tags
instead of aborting the migration.

### FTS5

D1 supports the SQLite FTS5 extension, including `fts5vocab`; the source is
[SQL statements](https://developers.cloudflare.com/d1/sql-api/sql-statements/).
`0009` creates an external-content trigram table on `cards(front, back)`, three
triggers, and a `rebuild` backfill. The trigram tokenizer gives substring
semantics, so `MATCH 'front : "term"'` is the indexed equivalent of
`front LIKE '%term%'`.

Scope rules:

- **Owner-wide text:** use FTS. The plan is `SCAN cards_fts` + a primary-key
  probe per match, instead of scanning the owner's whole card range.
- **Deck-scoped text:** keep `LIKE`. The 500-card cap already bounds it; a
  cross-deck FTS result would be more work, not less.
- **Queries shorter than three characters:** keep `LIKE`, because the trigram
  tokenizer cannot match them.
- **Tag + text:** the tag index narrows the set first; `LIKE` on that subset is
  cheaper than a cross-deck FTS probe.

Caveats worth knowing:

- A broad query still costs proportional to the number of matches. FTS removes
  the non-matching scan, not the cost of matching most of the library.
- The table is external-content on `cards.rowid`. D1 does not expose `VACUUM`,
  but any future migration that rebuilds `cards` must run
  `INSERT INTO cards_fts(cards_fts) VALUES ('rebuild')` afterwards.
- Writes pay for the index. The harness proxy measured ~6 extra logical rows per
  ~490-character card; treat that as a lower bound because FTS5 stores terms in
  shadow B-trees.

Measured before/after for a tag filter and a selective owner-wide text query:

| Query                       | Before statements | Before rows read | After statements | After rows read |
| --------------------------- | ----------------: | ---------------: | ---------------: | --------------: |
| `search_cards?tag=deck-1`   |                 1 |          ≈50,000 |                1 |          ≈1,500 |
| `search_cards?query=23/456` |                 1 |          ≈50,000 |                1 |    ≈matches + 2 |

The tag figure assumes 500 cards carry the tag (one seeded deck) and two tags
per card. The text figure is the trigram probe plus one card and one
learning-state read per match.
