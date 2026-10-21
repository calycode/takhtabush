import type { ApiSuccess, TagSummary } from '@caly/shared';
import { apiFetch } from './client';

export function listTags() {
   return apiFetch<ApiSuccess<TagSummary[]>>('/tags');
}
