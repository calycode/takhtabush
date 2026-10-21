import { encodeCursor, decodeCursor } from '@caly/shared';
import { newId, nowIso } from '@caly/worker-kit';
import type { Deck } from '@caly/shared';
import type { AppEnv } from '../env';
import { mapDeck } from '../lib/map';

export function getDeckRow(env: AppEnv, id: string): Promise<Record<string, unknown> | null> {
   return env.DB.prepare('SELECT * FROM decks WHERE id = ? AND deleted_at IS NULL')
      .bind(id)
      .first<Record<string, unknown>>();
}

export async function listDecks(
   env: AppEnv,
   ownerId: string,
   opts: { limit: number; cursor?: string },
): Promise<{ items: Deck[]; nextCursor: string | null }> {
   const decoded = opts.cursor ? decodeCursor(opts.cursor) : null;
   const params: unknown[] = [ownerId];
   let sql = 'SELECT * FROM decks WHERE owner_id = ? AND deleted_at IS NULL';
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
   input: { ownerId: string; title: string; description?: string; folderId?: string },
): Promise<Deck> {
   const id = newId('deck');
   const now = nowIso();
   await env.DB.prepare(
      `INSERT INTO decks (id, owner_id, title, description, folder_id, card_count, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, NULL)`,
   )
      .bind(
         id,
         input.ownerId,
         input.title,
         input.description ?? null,
         input.folderId ?? null,
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
      folderId?: string | null;
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
   if (patch.folderId !== undefined) {
      sets.push('folder_id = ?');
      params.push(patch.folderId);
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

/** Recompute `decks.card_count` from live cards. */
export async function recalcCardCount(env: AppEnv, deckId: string): Promise<void> {
   await env.DB.prepare(
      `UPDATE decks SET card_count = (SELECT COUNT(*) FROM cards WHERE deck_id = ? AND deleted_at IS NULL) WHERE id = ?`,
   )
      .bind(deckId, deckId)
      .run();
}
