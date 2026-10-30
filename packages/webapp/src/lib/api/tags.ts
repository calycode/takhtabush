import type { ApiSuccess, TagSummary } from '@caly/shared';
import { apiFetch } from './client';

/** Tag suggestions, scoped to one deck when the caller has one. */
export function listTags(deckId?: string) {
   const query = deckId ? `?deckId=${encodeURIComponent(deckId)}` : '';
   return apiFetch<ApiSuccess<TagSummary[]>>(`/tags${query}`);
}
