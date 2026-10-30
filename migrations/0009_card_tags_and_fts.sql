-- Migration 0009 — derived tag index and full-text front search
-- (SPEC §4.1, §4.2; docs/developer/d1-cost-model.md).
--
-- `cards.tags_json` stays the source of truth for display. `card_tags` is a
-- derived, rebuildable projection: one row per (card, tag), maintained by the
-- card write paths so tag filters are an index probe instead of
-- `tags_json LIKE '%"tag"%'` over every card the user owns.
--
-- `tag` is NOCASE so `WHERE tag = ?` keeps the old LIKE semantics (case
-- insensitive) and still uses the index below.

CREATE TABLE card_tags (
   card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
   owner_id TEXT NOT NULL REFERENCES users(id),
   deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
   tag TEXT NOT NULL COLLATE NOCASE,
   PRIMARY KEY (card_id, tag)
);

-- Tag filter: owner + exact tag, then the card id probe.
CREATE INDEX idx_card_tags_owner_tag ON card_tags(owner_id, tag, card_id);
-- Deck-scoped filter/count variant and the canonical deck tag list.
CREATE INDEX idx_card_tags_owner_deck_tag ON card_tags(owner_id, deck_id, tag, card_id);

-- Backfill from the JSON source. `json_each` is guarded so a malformed legacy
-- value cannot abort the migration; soft-deleted cards are excluded.
INSERT OR IGNORE INTO card_tags (card_id, owner_id, deck_id, tag)
SELECT c.id,
       c.owner_id,
       c.deck_id,
       trim(j.value)
  FROM cards c,
       json_each(CASE WHEN json_valid(c.tags_json) THEN c.tags_json ELSE '[]' END) j
 WHERE c.deleted_at IS NULL
   AND j.type = 'text'
   AND length(trim(j.value)) > 0;

-- FTS5 is a supported D1 SQLite extension
-- (https://developers.cloudflare.com/d1/sql-api/sql-statements/). The trigram
-- tokenizer gives substring semantics, so `MATCH '"term"'` behaves like
-- `LIKE '%term%'` but uses an index. D1 requires external-content tables to be
-- kept in sync by triggers; `pruneDeletedCards` deletes cards, which fires the
-- delete trigger as well as the soft-delete path's explicit cleanup.
CREATE VIRTUAL TABLE cards_fts USING fts5(
   front,
   back,
   content='cards',
   content_rowid='rowid',
   tokenize='trigram'
);

CREATE TRIGGER cards_fts_ai AFTER INSERT ON cards BEGIN
   INSERT INTO cards_fts(rowid, front, back)
   VALUES (new.rowid, new.front, coalesce(new.back, ''));
END;

CREATE TRIGGER cards_fts_ad AFTER DELETE ON cards BEGIN
   INSERT INTO cards_fts(cards_fts, rowid, front, back)
   VALUES ('delete', old.rowid, old.front, coalesce(old.back, ''));
END;

CREATE TRIGGER cards_fts_au AFTER UPDATE OF front, back ON cards BEGIN
   INSERT INTO cards_fts(cards_fts, rowid, front, back)
   VALUES ('delete', old.rowid, old.front, coalesce(old.back, ''));
   INSERT INTO cards_fts(rowid, front, back)
   VALUES (new.rowid, new.front, coalesce(new.back, ''));
END;

INSERT INTO cards_fts(cards_fts) VALUES ('rebuild');
