# D1 cost model

Takhtabush keeps every structured row in one D1 database. D1 bills **rows
scanned and rows written**, not requests or bytes, and one database is
single-threaded. That makes an accidental per-row query loop expensive twice: it
spends the daily read budget and it serializes the whole database.

This page records the current limits, the measured cost of each endpoint at a
realistic size, every query-per-row loop the audit found, and the caps that keep
the numbers bounded. It is the reference for `packages/shared/src/domain/limits.ts`.

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
- Every request pays 2 fixed auth queries (session + user, 2 rows).

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

| Action                          | Before subrequests | Before rows read | After subrequests | After rows read | Main change                                             |
| ------------------------------- | -----------------: | ---------------: | ----------------: | --------------: | ------------------------------------------------------- |
| `list_decks` (MCP, page of 20)  |                  2 |           ≈5,021 |                 2 |          ≈2,021 | Due counts scoped to the page, `learning_state.deck_id` |
| Deck detail                     |                  1 |                1 |                 1 |               1 | —                                                       |
| Card list (page of 20)          |                  2 |               22 |                 2 |              22 | Keyset index now covers the `id` tie-break              |
| `search_cards` (deck-scoped)    |                  1 |              501 |                 1 |             501 | Unchanged; `LIKE` remains a scan (§7)                   |
| Start session (learn)           |                  6 |          ≈10,020 |                 6 |            ≈720 | Deck-first weak aggregate, deck-scoped due queue        |
| Record review                   |                  7 |             ≈205 |                 7 |            ≈205 | `COUNT(DISTINCT)` instead of materializing ids          |
| `get_study_session` (300 cards) |            **303** |             ≈603 |             **7** |            ≈603 | One chunked `IN (…)` read per 90 ids                    |
| Session detail (resume)         |                  2 |             ≈501 |                 2 |            ≈501 | —                                                       |
| Import 200 new rows             |            **802** |         ≈101,000 |             **7** |            ≈501 | Batched inserts, one slot reservation, no recount       |
| Deck stats                      |                  7 |          ≈25,600 |                 7 |          ≈6,900 | Three deck-scoped reads replace whole-library scans     |

The two large numbers before the change are real: the harness measured 303
statements for a 300-card snapshot and 802 for a 200-row import. The 1,000-query
paid limit is close for imports; the 50-query free limit is already exceeded by a
25-row import.

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

| #   | Location                                                                        | Pattern                                                                                                                                  | Status                                                                                               |
| --- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1   | `services/mcp-services.ts` `getStudySession`                                    | `for (cardId of plannedCardIds) getCardRow(...)` — one query per card                                                                    | **Fixed**: `getCardRowsByIds` chunks 90 ids per statement                                            |
| 2   | `services/import-service.ts`                                                    | Per row: `createCard` (deck read, insert, select, full `card_count` recount) or `patchCard` (card read, revision insert, update, select) | **Fixed**: batched inserts, batched revision+update, one reservation                                 |
| 3   | `services/mcp-services.ts` `createCards`                                        | `Promise.all(cards.map(createCard))` — 4 statements per card                                                                             | **Fixed**: bulk service, one reservation, `db.batch()` inserts                                       |
| 4   | `repositories/decks.ts` `recalcCardCount`                                       | `COUNT(*)` over the whole deck after **every** card write; O(deck) rows read per write                                                   | **Fixed**: atomic `card_count` reservation/decrement                                                 |
| 5   | `repositories/maintenance.ts` `deleteMediaRows`                                 | `DELETE` per media id (up to 200 per run)                                                                                                | **Fixed**: chunked `DELETE … WHERE id IN (…)`                                                        |
| 6   | `repositories/maintenance.ts` `selectOrphanedMedia`                             | `NOT EXISTS (… OR image_media_id = ? OR audio_media_id = ?)` had no usable index; plan showed `SCAN c` **per media row**                 | **Fixed**: partial indexes on both media columns (plan is now `MULTI-INDEX OR`)                      |
| 7   | `repositories/study.ts` `listWeakCardIds`, `getWeakCards`, `getReviewAggregate` | Join started from `review_events`, so each deck's stat scanned **every event the user ever recorded**                                    | **Fixed**: `CROSS JOIN` forces the deck's cards to drive; one index probe per card                   |
| 8   | `repositories/study.ts` `getReviewStreak`                                       | Scanned all review events to build the day set                                                                                           | **Bounded**: last 400 days only, served by `idx_reviews_user_time`                                   |
| 9   | `repositories/study.ts` `deckDueCounts`                                         | Whole-owner due aggregate for a 20-deck MCP page                                                                                         | **Fixed**: page deck ids + `learning_state.deck_id` index                                            |
| 10  | `services/tag-service.ts` → `listOwnedTagStrings`                               | Read every card's `tags_json` for suggestions                                                                                            | **Bounded** for the card editor (`?deckId=` → ≤500 cards); the global list is a documented follow-up |
| 11  | `routes/decks.ts` export                                                        | `SELECT *` for every live card                                                                                                           | **Bounded** by the 500-card cap; one query                                                           |
| 12  | `middleware/auth.ts`                                                            | Session + user lookup on every request                                                                                                   | Constant (2 queries); left as-is                                                                     |

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
- One imported card writes 1 row + 6 index entries (~7 rows); 500 cards ≈ 3,500
  rows written.
- The free write budget (100k/day) allows ~28,000 reviews/day or ~28 imports of
  500 cards.

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

- **Tag search.** `tags_json LIKE '%"tag"%'` cannot use a B-tree index. The
  durable fix is a `card_tags(card_id, tag)` table (one row per tag, indexed on
  `tag`) or FTS5, at the cost of one join. Until then, tag suggestions are
  deck-scoped, which keeps them under the card cap.
- **Full-text front search.** `LIKE '%term%'` scans the owner's cards. FTS5 on
  `cards(front, back)` is the next step if search becomes a hot path.
- **A deck id inside `review_events`.** Stats are already deck-scoped through the
  cards join; adding `deck_id` there would remove the join but add a column to
  the append-only table, which is not worth it.

## 7. Rewrites that did not land (recommended follow-ups)

1. **`card_tags` table or FTS5.** Makes global tag counts O(tags) instead of
   O(cards), and makes tag filtering indexable instead of a JSON `LIKE`.
2. **FTS5 for `search_cards`.** Keeps `LIKE` out of the hot path. Needs a content
   table and triggers, so it deserves its own change.
3. **Cache the streak.** `getReviewStreak` is the largest remaining per-stats
   read (it must see ~400 days of events). A per-user `stats_cache` row keyed by
   day would remove it from the request path.
4. **Merge the two auth queries.** `SELECT s.user_id, u.* FROM sessions s JOIN
users u …` would halve the fixed 2-row cost of every request. Low impact.
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
| Tag length              |      40 | Existing; keeps the `%tag%` pattern inside D1's 50-byte `LIKE` limit.                                                                                                                                                                                                                                          |
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

Moving tag organisation out of decks (a normalized `card_tags` table) means a
join on every card read and an extra write per tag, to solve an organisation
problem that is really about decks. Collections add **one nullable column to
`decks`** and zero joins to card reads.

The design is deliberately flat:

- `collections(id, owner_id, name, position, created_at, updated_at, deleted_at)`
  — prefixed `col_` ids, owner-scoped.
- `decks.collection_id TEXT REFERENCES collections(id) ON DELETE SET NULL` —
  deleting a collection never deletes a deck. The API also detaches decks on
  soft delete, so the UI never shows a deck pointing at a hidden collection.
- `position` orders the sidebar; decks are ordered by `updated_at` inside a
  collection, using `idx_decks_collection`.
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
pnpm d1:cost          # table of statements / subrequests / rows returned
pnpm d1:cost:plans    # same, plus EXPLAIN QUERY PLAN for plan/session/stats
pnpm db:migrate:local # verify the migration applies to a real D1
```

The harness needs Node's built-in `node:sqlite` (Node 22.5+, unflagged from Node
23.4). It never touches `wrangler` state, remote D1, or production.
