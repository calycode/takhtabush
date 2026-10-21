import type {
   MediaCompleteInput,
   MediaIntentInput,
   MediaIntentResponse,
   MediaObject,
} from '@caly/shared';
import { maxBytesFor } from '@caly/shared';
import type { AppEnv } from '../env';
import { AppError, forbidden, notFound } from '../lib/errors';
import { mapMedia } from '../lib/map';
import { getMediaRow, insertMedia, markMediaReady } from '../repositories/media';

export async function createUploadIntent(
   env: AppEnv,
   userId: string,
   input: MediaIntentInput,
): Promise<MediaIntentResponse> {
   const max = maxBytesFor(input.mimeType);
   if (max === null) throw new AppError('UNSUPPORTED_MEDIA_TYPE', 'Unsupported media type', 422);
   if (input.byteSize > max) {
      throw new AppError('MEDIA_TOO_LARGE', `File exceeds the ${max} byte limit`, 413);
   }

   const media = await insertMedia(env, {
      ownerId: userId,
      filename: input.filename,
      mimeType: input.mimeType,
      byteSize: input.byteSize,
   });

   return {
      media,
      // Same-origin path so the browser upload flows through the normal origin
      // (and the Vite dev proxy) rather than the absolute Worker URL.
      uploadUrl: `/api/v1/media/${media.id}/content`,
      uploadMethod: 'PUT',
   };
}

async function getOwnedMediaRow(env: AppEnv, userId: string, id: string) {
   const row = await getMediaRow(env, id);
   if (!row) throw notFound('Media not found');
   if (String(row.owner_id) !== userId) throw forbidden('You do not own this media object');
   return row;
}

export async function storeUpload(
   env: AppEnv,
   userId: string,
   id: string,
   body: ArrayBuffer,
   contentType: string | undefined,
): Promise<MediaObject> {
   const row = await getOwnedMediaRow(env, userId, id);
   const mimeType = contentType ?? String(row.mime_type);
   const max = maxBytesFor(mimeType);
   if (max === null) throw new AppError('UNSUPPORTED_MEDIA_TYPE', 'Unsupported media type', 422);
   if (body.byteLength > max) {
      throw new AppError('MEDIA_TOO_LARGE', `File exceeds the ${max} byte limit`, 413);
   }

   await env.MEDIA.put(String(row.r2_key), body, { httpMetadata: { contentType: mimeType } });
   const media = await markMediaReady(env, id, { byteSize: body.byteLength });
   if (!media) throw notFound('Media not found');
   return media;
}

export async function completeUpload(
   env: AppEnv,
   userId: string,
   id: string,
   input: MediaCompleteInput,
): Promise<MediaObject> {
   const row = await getOwnedMediaRow(env, userId, id);
   const object = await env.MEDIA.head(String(row.r2_key));
   if (!object) throw new AppError('UPLOAD_INCOMPLETE', 'No uploaded object found', 409);

   const media = await markMediaReady(env, id, {
      byteSize: input.byteSize ?? object.size,
      checksum: input.checksum,
   });
   if (!media) throw notFound('Media not found');
   return media;
}

export function getMediaMetadata(env: AppEnv, id: string): Promise<Record<string, unknown> | null> {
   return getMediaRow(env, id);
}

/** Stream an object from R2 for the authenticated read proxy (SPEC §5.4). */
export async function readMediaObject(
   env: AppEnv,
   mediaId: string,
   userId: string,
): Promise<Response> {
   const row = await getOwnedMediaRow(env, userId, mediaId);
   const object = await env.MEDIA.get(String(row.r2_key));
   if (!object) throw notFound('Media object not found');

   const headers = new Headers();
   headers.set('content-type', String(row.mime_type));
   headers.set('cache-control', 'private, max-age=3600');
   headers.set('etag', object.httpEtag);
   return new Response(object.body, { headers });
}

export function toMediaObject(row: Record<string, unknown>): MediaObject {
   return mapMedia(row);
}
