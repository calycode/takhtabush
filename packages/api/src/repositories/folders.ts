import { newId, nowIso } from '@caly/worker-kit';
import type { Folder } from '@caly/shared';
import type { AppEnv } from '../env';
import { mapFolder } from '../lib/map';

export async function listFolders(env: AppEnv, ownerId: string): Promise<Folder[]> {
   const result = await env.DB.prepare(
      'SELECT * FROM folders WHERE owner_id = ? AND deleted_at IS NULL ORDER BY name ASC',
   )
      .bind(ownerId)
      .all<Record<string, unknown>>();
   return (result.results ?? []).map(mapFolder);
}

export function getFolderRow(env: AppEnv, id: string): Promise<Record<string, unknown> | null> {
   return env.DB.prepare('SELECT * FROM folders WHERE id = ? AND deleted_at IS NULL')
      .bind(id)
      .first<Record<string, unknown>>();
}

export async function insertFolder(
   env: AppEnv,
   input: { ownerId: string; name: string; parentId?: string },
): Promise<Folder> {
   const id = newId('fold');
   await env.DB.prepare(
      'INSERT INTO folders (id, owner_id, name, parent_id, created_at, deleted_at) VALUES (?, ?, ?, ?, ?, NULL)',
   )
      .bind(id, input.ownerId, input.name, input.parentId ?? null, nowIso())
      .run();
   const row = await getFolderRow(env, id);
   if (!row) throw new Error('Failed to create folder');
   return mapFolder(row);
}

export async function updateFolder(
   env: AppEnv,
   id: string,
   patch: { name?: string; parentId?: string | null },
): Promise<Folder | null> {
   const sets: string[] = [];
   const params: unknown[] = [];
   if (patch.name !== undefined) {
      sets.push('name = ?');
      params.push(patch.name);
   }
   if (patch.parentId !== undefined) {
      sets.push('parent_id = ?');
      params.push(patch.parentId);
   }
   if (sets.length > 0) {
      params.push(id);
      await env.DB.prepare(`UPDATE folders SET ${sets.join(', ')} WHERE id = ?`)
         .bind(...params)
         .run();
   }
   const row = await getFolderRow(env, id);
   return row ? mapFolder(row) : null;
}

export async function softDeleteFolder(env: AppEnv, id: string): Promise<void> {
   await env.DB.prepare('UPDATE folders SET deleted_at = ? WHERE id = ?').bind(nowIso(), id).run();
}
