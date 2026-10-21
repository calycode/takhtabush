/** Pagination metadata attached to list responses (SPEC §6.1). */
export type CursorMeta = {
   nextCursor: string | null;
   hasMore: boolean;
};

/** Standard success envelope (SPEC §6.1). */
export function ok<T>(data: T, meta?: Record<string, unknown>) {
   return meta ? { data, meta } : { data };
}

/** Cursor-paginated success envelope (SPEC §6.1). */
export function paginated<T>(items: T[], meta: CursorMeta) {
   return { data: items, meta };
}

export type ApiErrorBody = {
   error: {
      code: string;
      message: string;
      details?: unknown;
   };
};

/** Standard error envelope (SPEC §6.1). */
export function errorEnvelope(code: string, message: string, details?: unknown): ApiErrorBody {
   return { error: details === undefined ? { code, message } : { code, message, details } };
}
