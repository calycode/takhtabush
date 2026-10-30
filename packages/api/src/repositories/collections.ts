import { newId, nowIso } from '@caly/worker-kit';
import type { Collection } from '@caly/shared';
import type { AppEnv } from '../env';
import { changes } from '../lib/d1';

const COLLECTION_SELECT = `SELECT c.id, c.owner_id, c.name, c.position, c.created_at, c.updated_at,
       c.deleted_at, COUNT(d.id) AS deck_count
  FROM collections c
  LEFT JOIN decks d ON d.collection_id = c.id AND d.deleted_at IS NULL`;

export function mapCollection(row: Record<string, unknown>): Collection {
   return {
      id: String(row.id),
      ownerId: String(row.owner_id),
      name: String(row.name),
      position: Number(row.position ?? 0),
      deckCount: Number(row.deck_count ?? 0),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at ?? row.created_at),
      deletedAt: (row.deleted_at as string | null) ?? null,
   };
}

/**
 * One query, one pass: the LEFT JOIN + GROUP BY counts decks per collection
 * without a correlated subquery per row. Collections per user are capped, so
 * the list is bounded and needs no cursor (SPEC §4.4).
 */
export async function listCollections(env: AppEnv, ownerId: string): Promise<Collection[]> {
   const result = await env.DB.prepare(
      `${COLLECTION_SELECT}
        WHERE c.owner_id = ? AND c.deleted_at IS NULL
        GROUP BY c.id
        ORDER BY c.position ASC, c.name ASC, c.id ASC`,
   )
      .bind(ownerId)
      .all<Record<string, unknown>>();
   return (result.results ?? []).map(mapCollection);
}

export function getCollectionRow(env: AppEnv, id: string): Promise<Record<string, unknown> | null> {
   return env.DB.prepare(
      `${COLLECTION_SELECT}
        WHERE c.id = ? AND c.deleted_at IS NULL
        GROUP BY c.id`,
   )
      .bind(id)
      .first<Record<string, unknown>>();
}

export async function countCollections(env: AppEnv, ownerId: string): Promise<number> {
   const row = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM collections WHERE owner_id = ? AND deleted_at IS NULL',
   )
      .bind(ownerId)
      .first<{ count: number }>();
   return Number(row?.count ?? 0);
}

export async function insertCollection(
   env: AppEnv,
   input: { ownerId: string; name: string; position?: number },
): Promise<Collection> {
   const id = newId('col');
   const now = nowIso();
   await env.DB.prepare(
      `INSERT INTO collections (id, owner_id, name, position, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, COALESCE(?, (SELECT COALESCE(MAX(position), 0) + 1 FROM collections WHERE owner_id = ?)), ?, ?, NULL)`,
   )
      .bind(id, input.ownerId, input.name, input.position ?? null, input.ownerId, now, now)
      .run();
   const row = await getCollectionRow(env, id);
   if (!row) throw new Error('Failed to create collection');
   return mapCollection(row);
}

export async function updateCollection(
   env: AppEnv,
   id: string,
   patch: { name?: string; position?: number },
): Promise<Collection | null> {
   const sets: string[] = [];
   const params: unknown[] = [];
   if (patch.name !== undefined) {
      sets.push('name = ?');
      params.push(patch.name);
   }
   if (patch.position !== undefined) {
      sets.push('position = ?');
      params.push(patch.position);
   }
   if (sets.length > 0) {
      sets.push('updated_at = ?');
      params.push(nowIso(), id);
      await env.DB.prepare(`UPDATE collections SET ${sets.join(', ')} WHERE id = ?`)
         .bind(...params)
         .run();
   }
   const row = await getCollectionRow(env, id);
   return row ? mapCollection(row) : null;
}

export async function softDeleteCollection(env: AppEnv, id: string): Promise<boolean> {
   const result = await env.DB.prepare(
      'UPDATE collections SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
   )
      .bind(nowIso(), nowIso(), id)
      .run();
   return changes(result) > 0;
}
