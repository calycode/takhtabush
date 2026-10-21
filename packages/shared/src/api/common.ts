import { z } from 'zod';

/** Any API identifier, e.g. `deck_abc`. */
export const idSchema = z.string().min(1);

/** ISO-8601 timestamp produced by the API. */
export const isoDateSchema = z.string().min(1);

/** Shared cursor-pagination query parameters (SPEC §6.1). Default page 20, max 50. */
export const cursorQuerySchema = z.object({
   cursor: z.string().min(1).optional(),
   limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type CursorQuery = z.infer<typeof cursorQuerySchema>;

/** Keyset cursor: `<updatedAt>|<id>`, URL-encoded by the caller when needed. */
export function encodeCursor(updatedAt: string, id: string): string {
   return `${updatedAt}|${id}`;
}

export function decodeCursor(cursor: string): { updatedAt: string; id: string } | null {
   const separator = cursor.lastIndexOf('|');
   if (separator < 0) return null;
   return { updatedAt: cursor.slice(0, separator), id: cursor.slice(separator + 1) };
}
