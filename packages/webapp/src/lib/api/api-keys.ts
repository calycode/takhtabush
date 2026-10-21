import type { ApiKey, ApiSuccess, CreateApiKeyInput, CreateApiKeyResponse } from '@caly/shared';
import { apiFetch } from './client';

export function listApiKeys() {
   return apiFetch<ApiSuccess<ApiKey[]>>('/api-keys');
}

export function createApiKey(input: CreateApiKeyInput) {
   return apiFetch<ApiSuccess<CreateApiKeyResponse>>('/api-keys', {
      method: 'POST',
      body: JSON.stringify(input),
   });
}

export function revokeApiKey(id: string) {
   return apiFetch<void>(`/api-keys/${id}`, { method: 'DELETE' });
}
