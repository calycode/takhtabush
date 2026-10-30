import { encodeCursor, decodeCursor } from '@caly/shared';
import { newId, nowIso } from '@caly/worker-kit';
import type { Deck } from '@caly/shared';
import type { AppEnv } from '../env';
import { changes } from '../lib/d1';
import { mapDeck } from '../lib/map';

export function getDeckRow(env: AppEnv, id: string): Promise<Record<string, unknown> | null> {
   return env.DB.prepare('SELECT * FROM decks WHERE id = ? AND deleted_at IS NULL')
      .bind(id)
      .first<Record<string, unknown>>();
}

export async function listDecks(
   env: AppEnv,
   ownerId: string,
   opts: { limit: number; cursor?: string; collectionId?: string; unfiled?: boolean },
): Promise<{ items: Deck[]; nextCursor: string | null }> {
   const decoded = opts.cursor ? decodeCursor(opts.cursor) : null;
   const params: unknown[] = [ownerId];
   let sql = 'SELECT * FROM decks WHERE owner_id = ? AND deleted_at IS NULL';
   if (opts.collectionId) {
      sql += ' AND collection_id = ?';
      params.push(opts.collectionId);
   } else if (opts.unfiled) {
      sql += ' AND collection_id IS NULL';
   }
   if (decoded) {
      sql += ' AND (updated_at < ? OR (updated_at = ? AND id < ?))';
      params.push(decoded.updatedAt, decoded.updatedAt, decoded.id);
   }
   sql += ' ORDER BY updated_at DESC, id DESC LIMIT ?';
   params.push(opts.limit + 1);

   const result = await env.DB.prepare(sql)
      .bind(...params)
      .all<Record<string, unknown>>();
   const rows = result.results ?? [];
   const hasMore = rows.length > opts.limit;
   const page = hasMore ? rows.slice(0, opts.limit) : rows;
   const last = page[page.length - 1];
   return {
      items: page.map(mapDeck),
      nextCursor: hasMore && last ? encodeCursor(String(last.updated_at), String(last.id)) : null,
   };
}

export async function insertDeck(
   env: AppEnv,
   input: {
      ownerId: string;
      title: string;
      description?: string;
      collectionId?: string;
   },
): Promise<Deck> {
   const id = newId('deck');
   const now = nowIso();
   await env.DB.prepare(
      `INSERT INTO decks (id, owner_id, title, description, collection_id, card_count, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, NULL)`,
   )
      .bind(
         id,
         input.ownerId,
         input.title,
         input.description ?? null,
         input.collectionId ?? null,
         now,
         now,
      )
      .run();
   const row = await getDeckRow(env, id);
   if (!row) throw new Error('Failed to create deck');
   return mapDeck(row);
}

export async function updateDeck(
   env: AppEnv,
   id: string,
   patch: {
      title?: string;
      description?: string | null;
      collectionId?: string | null;
   },
): Promise<Deck | null> {
   const sets: string[] = [];
   const params: unknown[] = [];
   if (patch.title !== undefined) {
      sets.push('title = ?');
      params.push(patch.title);
   }
   if (patch.description !== undefined) {
      sets.push('description = ?');
      params.push(patch.description);
   }
   if (patch.collectionId !== undefined) {
      sets.push('collection_id = ?');
      params.push(patch.collectionId);
   }
   if (sets.length > 0) {
      sets.push('updated_at = ?');
      params.push(nowIso(), id);
      await env.DB.prepare(`UPDATE decks SET ${sets.join(', ')} WHERE id = ?`)
         .bind(...params)
         .run();
   }
   const row = await getDeckRow(env, id);
   return row ? mapDeck(row) : null;
}

export async function softDeleteDeck(env: AppEnv, id: string): Promise<void> {
   const now = nowIso();
   await env.DB.prepare('UPDATE decks SET deleted_at = ?, updated_at = ? WHERE id = ?')
      .bind(now, now, id)
      .run();
   await env.DB.prepare(
      'UPDATE cards SET deleted_at = ?, updated_at = ? WHERE deck_id = ? AND deleted_at IS NULL',
   )
      .bind(now, now, id)
      .run();
}

/**
 * Reserve `count` live-card slots on a deck in one conditional UPDATE. Returns
 * false when the deck is full (or the reservation would cross the cap), which
 * is the only authoritative card-count check: `decks.card_count` is the
 * denormalized counter, and D1 serializes writes per database, so this cannot
 * oversell a deck. Callers release the slots if the following insert fails.
 */
export async function reserveCardSlots(
   env: AppEnv,
   deckId: string,
   count: number,
   limit: number,
): Promise<boolean> {
   if (count <= 0) return true;
   const result = await env.DB.prepare(
      `UPDATE decks SET card_count = card_count + ?, updated_at = ?
        WHERE id = ? AND deleted_at IS NULL AND card_count + ? <= ?`,
   )
      .bind(count, nowIso(), deckId, count, limit)
      .run();
   return changes(result) > 0;
}

/** Give reserved slots back after a failed insert. Never goes below zero. */
export async function releaseCardSlots(env: AppEnv, deckId: string, count: number): Promise<void> {
   if (count <= 0) return;
   await env.DB.prepare(
      `UPDATE decks SET card_count = MAX(card_count - ?, 0), updated_at = ? WHERE id = ?`,
   )
      .bind(count, nowIso(), deckId)
      .run();
}

/** Live decks in a collection, used to enforce the per-collection cap. */
export async function countDecksInCollection(
   env: AppEnv,
   ownerId: string,
   collectionId: string,
): Promise<number> {
   const row = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM decks
        WHERE owner_id = ? AND collection_id = ? AND deleted_at IS NULL`,
   )
      .bind(ownerId, collectionId)
      .first<{ count: number }>();
   return Number(row?.count ?? 0);
}

/** Detach every deck from a collection (collection delete keeps decks). */
export async function detachDecksFromCollection(
   env: AppEnv,
   ownerId: string,
   collectionId: string,
): Promise<void> {
   const now = nowIso();
   await env.DB.prepare(
      `UPDATE decks SET collection_id = NULL, updated_at = ?
        WHERE owner_id = ? AND collection_id = ? AND deleted_at IS NULL`,
   )
      .bind(now, ownerId, collectionId)
      .run();
}
