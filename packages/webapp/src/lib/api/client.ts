import type { ApiFailure } from '@caly/shared';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

/** Read the double-submit CSRF cookie set on login (SPEC §3.2). */
function readCookie(name: string): string | null {
   if (typeof document === 'undefined') return null;
   const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
   return match ? decodeURIComponent(match[1]) : null;
}

export class ApiError extends Error {
   constructor(
      readonly status: number,
      readonly code: string,
      message: string,
      readonly details?: unknown,
   ) {
      super(message);
      this.name = 'ApiError';
   }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
   const method = (init?.method ?? 'GET').toUpperCase();
   const headers = new Headers(init?.headers);
   if (init?.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
   if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const csrf = readCookie('csrf');
      if (csrf) headers.set('x-csrf-token', csrf);
   }

   const response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: 'include',
      ...init,
      headers,
   });

   if (response.status === 204) return undefined as T;

   const payload = (await response.json().catch(() => null)) as ApiFailure | T | null;

   if (!response.ok) {
      const error = (payload as ApiFailure | null)?.error;
      throw new ApiError(
         response.status,
         error?.code ?? 'UNKNOWN',
         error?.message ?? `Request failed: ${response.status}`,
         error?.details,
      );
   }

   return payload as T;
}
