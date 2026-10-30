/**
 * D1 has a hard ceiling of 100 bound parameters per statement
 * (https://developers.cloudflare.com/d1/platform/limits/), so any `IN (...)`
 * lookup is chunked. Keeping one helper means every batched read stays under
 * the limit and no call site grows its own ad-hoc chunk size.
 */
export const D1_MAX_BOUND_PARAMS = 100;

/** Split a list into chunks of at most `size` items. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
   const chunks: T[][] = [];
   for (let index = 0; index < items.length; index += size) {
      chunks.push(items.slice(index, index + size) as T[]);
   }
   return chunks;
}

/** `?, ?, ?` for an `IN (...)` list of `count` values. */
export function placeholders(count: number): string {
   return Array.from({ length: count }, () => '?').join(', ');
}

/** Read a D1 row batch's `meta.changes`, defaulting to 0. */
export function changes(result: { meta?: { changes?: number } } | undefined): number {
   return result?.meta?.changes ?? 0;
}
