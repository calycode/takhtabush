-- Migration 0005 — remove the dead `learning_state.suspended` column.
-- Suspension is implemented via `cards.status` (per-card, single tenant), and
-- the column was only ever read (never written), so its filters were no-ops.

DROP INDEX idx_learning_due;

ALTER TABLE learning_state DROP COLUMN suspended;

CREATE INDEX idx_learning_due ON learning_state(user_id, due_at);
