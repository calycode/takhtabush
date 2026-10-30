import type {
   ApiSuccess,
   Collection,
   CreateCollectionInput,
   UpdateCollectionInput,
} from '@caly/shared';
import { apiFetch } from './client';

export function listCollections() {
   return apiFetch<ApiSuccess<Collection[]>>('/collections');
}

export function createCollection(input: CreateCollectionInput) {
   return apiFetch<ApiSuccess<Collection>>('/collections', {
      method: 'POST',
      body: JSON.stringify(input),
   });
}

export function updateCollection(id: string, input: UpdateCollectionInput) {
   return apiFetch<ApiSuccess<Collection>>(`/collections/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
   });
}

export function deleteCollection(id: string) {
   return apiFetch<void>(`/collections/${id}`, { method: 'DELETE' });
}
