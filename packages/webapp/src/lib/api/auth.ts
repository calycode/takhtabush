import type { ApiSuccess, AuthStatus, MeResponse, SessionInfo, User } from '@caly/shared';
import { apiFetch } from './client';

export function getAuthStatus() {
   return apiFetch<ApiSuccess<AuthStatus>>('/auth/status');
}

export function setupOwner(email: string, token: string) {
   return apiFetch<ApiSuccess<{ user: User }>>('/auth/setup', {
      method: 'POST',
      body: JSON.stringify({ email, token }),
   });
}

export function requestMagicLink(email: string, invite?: string, next?: string) {
   const body: { email: string; invite?: string; next?: string } = { email };
   if (invite) body.invite = invite;
   if (next) body.next = next;
   return apiFetch<ApiSuccess<{ sent: true; devToken?: string }>>('/auth/magic-link', {
      method: 'POST',
      body: JSON.stringify(body),
   });
}

export function verifyMagicLink(token: string) {
   return apiFetch<ApiSuccess<{ user: User }>>('/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ token }),
   });
}

export function logout() {
   return apiFetch<void>('/auth/logout', { method: 'POST' });
}

export function getMe() {
   return apiFetch<ApiSuccess<MeResponse>>('/me');
}

export function listSessions() {
   return apiFetch<ApiSuccess<SessionInfo[]>>('/sessions');
}

export function revokeSession(id: string) {
   return apiFetch<void>(`/sessions/${id}`, { method: 'DELETE' });
}

export function revokeOtherSessions() {
   return apiFetch<ApiSuccess<{ revoked: number }>>('/sessions', { method: 'DELETE' });
}

export function updateMe(input: { displayName?: string }) {
   return apiFetch<ApiSuccess<{ user: User }>>('/me', {
      method: 'PATCH',
      body: JSON.stringify(input),
   });
}
