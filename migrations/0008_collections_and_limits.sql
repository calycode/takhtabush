-- Migration 0008 — collections, bounded decks, and the indexes found by the
-- D1 cost audit (SPEC §4.4, docs/developer/d1-cost-model.md).
--
-- `folders` never shipped a UI and stored no nesting beyond an unused
-- `parent_id`. It is renamed to `collections` and flattened: one level, ordered
-- by `position`, with decks pointing at it through a nullable FK.

ALTER TABLE folders RENAME TO collections;

ALTER TABLE collections ADD COLUMN position INTEGER NOT NULL DEFAULT 0;
ALTER TABLE collections ADD COLUMN updated_at TEXT;
UPDATE collections SET updated_at = created_at WHERE updated_at IS NULL;
ALTER TABLE collections DROP COLUMN parent_id;

-- `decks.collection_id` keeps ON DELETE SET NULL, so a hard delete of a
-- collection can never orphan or cascade a deck. ALTER TABLE ADD COLUMN may
-- carry a REFERENCES clause as long as the default is NULL.
ALTER TABLE decks ADD COLUMN collection_id TEXT REFERENCES collections(id) ON DELETE SET NULL;

UPDATE decks
   SET collection_id = folder_id
 WHERE folder_id IN (SELECT id FROM collections WHERE deleted_at IS NULL);

DROP INDEX idx_decks_folder;
ALTER TABLE decks DROP COLUMN folder_id;

CREATE INDEX idx_collections_owner ON collections(owner_id, deleted_at, position, name);
CREATE INDEX idx_decks_collection ON decks(owner_id, collection_id, deleted_at, updated_at DESC, id DESC);
-- Include `id` so the keyset tie-break is served by the index rather than a
-- temp b-tree ("USE TEMP B-TREE FOR LAST TERM OF ORDER BY" in the old plan).
-- These replace the narrower 0002 indexes, so writes do not maintain both.
CREATE INDEX idx_decks_owner_keyset ON decks(owner_id, deleted_at, updated_at DESC, id DESC);
CREATE INDEX idx_cards_deck_keyset ON cards(deck_id, deleted_at, updated_at DESC, id DESC);
DROP INDEX idx_decks_owner;
DROP INDEX idx_cards_deck;

-- `decks.card_count` becomes the authoritative denormalized counter; writes
-- reserve/decrement it atomically instead of recounting the deck. Recompute it
-- once here so any drift from the old recount-per-write path is cleared.
UPDATE decks
   SET card_count = (SELECT COUNT(*) FROM cards WHERE cards.deck_id = decks.id AND cards.deleted_at IS NULL);

-- Missing indexes found by the audit. Each one removes a full scan from a hot
-- path: session lists, review aggregation, cleanup, and orphaned-media checks.
CREATE INDEX idx_sessions_user_started ON study_sessions(user_id, started_at DESC);
CREATE INDEX idx_sessions_user_status_started ON study_sessions(user_id, status, started_at DESC);
CREATE INDEX idx_reviews_user_time ON review_events(user_id, reviewed_at DESC);
CREATE INDEX idx_reviews_card ON review_events(card_id);
CREATE INDEX idx_reviews_session_card ON review_events(session_id, card_id);
CREATE INDEX idx_revisions_card ON card_revisions(card_id);
CREATE INDEX idx_learning_card ON learning_state(card_id);
CREATE INDEX idx_cards_image ON cards(image_media_id) WHERE image_media_id IS NOT NULL;
CREATE INDEX idx_cards_audio ON cards(audio_media_id) WHERE audio_media_id IS NOT NULL;

-- `learning_state.deck_id` is a denormalized copy of `cards.deck_id` so due
-- counts, the due queue, and the forecast can address one deck's rows through
-- an index instead of scanning every due row the user owns. State is derived,
-- so the copy is always rebuildable from cards + review events.
ALTER TABLE learning_state ADD COLUMN deck_id TEXT;
UPDATE learning_state
   SET deck_id = (SELECT deck_id FROM cards WHERE cards.id = learning_state.card_id)
 WHERE deck_id IS NULL;
CREATE INDEX idx_learning_deck_due ON learning_state(user_id, deck_id, due_at);
