/** Free-form metadata attached to a successful API response. */
export type ApiMeta = Record<string, unknown>;

/** Standard successful response envelope (SPEC §6.1). */
export type ApiSuccess<T> = {
   data: T;
   meta?: ApiMeta;
};

/** Standard error response envelope (SPEC §6.1). */
export type ApiFailure = {
   error: {
      code: string;
      message: string;
      details?: unknown;
   };
};

/** A single cursor-paginated page. */
export type Page<T> = {
   items: T[];
   nextCursor?: string;
};
