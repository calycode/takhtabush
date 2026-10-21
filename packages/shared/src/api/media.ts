import { z } from 'zod';
import { idSchema, isoDateSchema } from './common';

export const mediaStatusSchema = z.enum(['pending', 'ready', 'deleted']);
export type MediaStatus = z.infer<typeof mediaStatusSchema>;

/** Allowed MIME types and size limits (SPEC §5.3). */
export const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
export const AUDIO_MIME_TYPES = ['audio/webm', 'audio/mpeg', 'audio/mp4', 'audio/wav'] as const;
export const ALLOWED_MIME_TYPES = [...IMAGE_MIME_TYPES, ...AUDIO_MIME_TYPES] as const;

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

export const mimeTypeSchema = z.enum(ALLOWED_MIME_TYPES);

export function isAudioMime(mime: string): boolean {
   return (AUDIO_MIME_TYPES as readonly string[]).includes(mime);
}

export function isAllowedMime(mime: string): boolean {
   return (ALLOWED_MIME_TYPES as readonly string[]).includes(mime);
}

/** Maximum size in bytes for a given MIME type, or `null` when unsupported. */
export function maxBytesFor(mime: string): number | null {
   if ((IMAGE_MIME_TYPES as readonly string[]).includes(mime)) return MAX_IMAGE_BYTES;
   if ((AUDIO_MIME_TYPES as readonly string[]).includes(mime)) return MAX_AUDIO_BYTES;
   return null;
}

export const mediaIntentInputSchema = z.object({
   mimeType: mimeTypeSchema,
   byteSize: z.number().int().positive(),
   filename: z.string().min(1).max(200),
});

export type MediaIntentInput = z.infer<typeof mediaIntentInputSchema>;

export const mediaCompleteInputSchema = z.object({
   byteSize: z.number().int().positive().optional(),
   checksum: z.string().max(200).optional(),
});

export type MediaCompleteInput = z.infer<typeof mediaCompleteInputSchema>;

export const mediaObjectSchema = z.object({
   id: idSchema,
   ownerId: idSchema,
   mimeType: z.string(),
   byteSize: z.number().int().nonnegative(),
   checksum: z.string().nullable(),
   status: mediaStatusSchema,
   createdAt: isoDateSchema,
});

export type MediaObject = z.infer<typeof mediaObjectSchema>;

/** Response to `POST /media/intent`: where the client should upload to. */
export const mediaIntentResponseSchema = z.object({
   media: mediaObjectSchema,
   uploadUrl: z.string(),
   uploadMethod: z.enum(['PUT']),
});

export type MediaIntentResponse = z.infer<typeof mediaIntentResponseSchema>;
