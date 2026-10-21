import { newId, nowIso } from '@caly/worker-kit';
import type { MediaObject } from '@caly/shared';
import type { AppEnv } from '../env';
import { mapMedia } from '../lib/map';

export function getMediaRow(env: AppEnv, id: string): Promise<Record<string, unknown> | null> {
   return env.DB.prepare('SELECT * FROM media_objects WHERE id = ? AND deleted_at IS NULL')
      .bind(id)
      .first<Record<string, unknown>>();
}

/** Build the R2 key for a media object (SPEC §5.1). */
export function mediaR2Key(ownerId: string, mediaId: string, filename: string): string {
   const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'object';
   return `media/${ownerId}/${mediaId}/${safe}`;
}

export async function insertMedia(
   env: AppEnv,
   input: { ownerId: string; filename: string; mimeType: string; byteSize: number },
): Promise<MediaObject> {
   const id = newId('med');
   const r2Key = mediaR2Key(input.ownerId, id, input.filename);
   await env.DB.prepare(
      `INSERT INTO media_objects (id, owner_id, r2_key, mime_type, byte_size, checksum, status, created_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, NULL, 'pending', ?, NULL)`,
   )
      .bind(id, input.ownerId, r2Key, input.mimeType, input.byteSize, nowIso())
      .run();
   const row = await getMediaRow(env, id);
   if (!row) throw new Error('Failed to create media object');
   return mapMedia(row);
}

export async function markMediaReady(
   env: AppEnv,
   id: string,
   patch: { byteSize?: number; checksum?: string },
): Promise<MediaObject | null> {
   const sets = ["status = 'ready'"];
   const params: unknown[] = [];
   if (patch.byteSize !== undefined) {
      sets.push('byte_size = ?');
      params.push(patch.byteSize);
   }
   if (patch.checksum !== undefined) {
      sets.push('checksum = ?');
      params.push(patch.checksum);
   }
   params.push(id);
   await env.DB.prepare(`UPDATE media_objects SET ${sets.join(', ')} WHERE id = ?`)
      .bind(...params)
      .run();
   const row = await getMediaRow(env, id);
   return row ? mapMedia(row) : null;
}

export async function softDeleteMedia(env: AppEnv, id: string): Promise<void> {
   await env.DB.prepare('UPDATE media_objects SET deleted_at = ? WHERE id = ?')
      .bind(nowIso(), id)
      .run();
}

export async function totalMediaBytes(env: AppEnv, ownerId: string): Promise<number> {
   const row = await env.DB.prepare(
      'SELECT COALESCE(SUM(byte_size), 0) AS total FROM media_objects WHERE owner_id = ? AND deleted_at IS NULL',
   )
      .bind(ownerId)
      .first<{ total: number }>();
   return Number(row?.total ?? 0);
}
