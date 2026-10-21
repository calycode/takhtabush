import type {
   ApiSuccess,
   MediaCompleteInput,
   MediaIntentResponse,
   MediaObject,
} from '@caly/shared';
import { apiFetch } from './client';

export function createMediaIntent(input: { mimeType: string; byteSize: number; filename: string }) {
   return apiFetch<ApiSuccess<MediaIntentResponse>>('/media/intent', {
      method: 'POST',
      body: JSON.stringify(input),
   });
}

export function completeMedia(id: string, input: MediaCompleteInput = {}) {
   return apiFetch<ApiSuccess<MediaObject>>(`/media/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify(input),
   });
}

/** Upload a file: intent → PUT content → complete. Returns the ready media object. */
export async function uploadCardMedia(file: File): Promise<MediaObject> {
   const intent = await createMediaIntent({
      mimeType: file.type,
      byteSize: file.size,
      filename: file.name,
   });

   await apiFetch<ApiSuccess<MediaObject>>(`/media/${intent.data.media.id}/content`, {
      method: 'PUT',
      body: file,
      headers: { 'content-type': file.type },
   });

   const completed = await completeMedia(intent.data.media.id, { byteSize: file.size });
   return completed.data;
}
