-- Migration 0010 — give every live collection a distinct position.
--
-- 0008 added `position INTEGER NOT NULL DEFAULT 0` to the renamed `folders`
-- table, so pre-existing collections all share position 0. The deck library's
-- up/down controls swap two positions; without distinct values those swaps are
-- no-ops. Renumber per owner in the existing display order (position, name, id).

WITH ordered AS (
   SELECT id,
          ROW_NUMBER() OVER (
             PARTITION BY owner_id
             ORDER BY position ASC, name ASC, id ASC
          ) AS next_position
     FROM collections
    WHERE deleted_at IS NULL
)
UPDATE collections
   SET position = (SELECT next_position FROM ordered WHERE ordered.id = collections.id)
 WHERE id IN (SELECT id FROM ordered);
