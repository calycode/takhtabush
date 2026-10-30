import type { Context, MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { newId } from '@caly/worker-kit';
import type { AppBindings } from '../env';
import { hashToken } from '../lib/crypto';
import { unauthorized } from '../lib/errors';
import { findActiveSessionUser } from '../repositories/sessions';
import { mapUserRow } from '../repositories/users';

export const SESSION_COOKIE = 'sid';
export const CSRF_COOKIE = 'csrf';
export const CSRF_HEADER = 'x-csrf-token';

function isSecure(c: Context<AppBindings>): boolean {
   // Cloudflare terminates TLS at the edge, so the request URL is the source of
   // truth even when APP_URL is empty or not set yet.
   return c.req.url.startsWith('https://');
}

export function setSessionCookie(c: Context<AppBindings>, token: string, expiresAt: string): void {
   const maxAge = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
   c.header(
      'set-cookie',
      `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${
         isSecure(c) ? '; Secure' : ''
      }`,
      { append: true },
   );
}

export function clearSessionCookie(c: Context<AppBindings>): void {
   c.header('set-cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`, {
      append: true,
   });
}

export function clearCsrfCookie(c: Context<AppBindings>): void {
   c.header('set-cookie', `${CSRF_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`, { append: true });
}

export function setCsrfCookie(c: Context<AppBindings>): void {
   const token = newId('tok');
   c.header(
      'set-cookie',
      `${CSRF_COOKIE}=${token}; Path=/; SameSite=Lax${isSecure(c) ? '; Secure' : ''}`,
      { append: true },
   );
   c.set('csrfToken', token);
}

/**
 * Resolve the caller from a session cookie or a bearer token and attach the
 * user to the context. Never rejects — use `requireAuth` for that.
 */
export const sessionMiddleware: MiddlewareHandler<AppBindings> = async (c, next) => {
   const bearer = c.req.header('authorization')?.replace(/^Bearer\s+/i, '');
   const token = bearer ?? getCookie(c, SESSION_COOKIE);

   if (token) {
      const tokenHash = await hashToken(c.env.SESSION_SECRET, token);
      const row = await findActiveSessionUser(c.env, tokenHash);
      if (row) {
         c.set('user', mapUserRow(row));
         c.set('sessionId', row.session_id);
      }
   }

   await next();
};

/** Reject the request when no authenticated user is attached. */
export const requireAuth: MiddlewareHandler<AppBindings> = async (c, next) => {
   if (!c.get('user')) throw unauthorized();
   await next();
};

/**
 * Double-submit CSRF check for cookie-authenticated mutations (SPEC §3.2).
 * Bearer-token requests are exempt (they cannot be forged cross-site).
 */
export const csrfProtection: MiddlewareHandler<AppBindings> = async (c, next) => {
   const method = c.req.method.toUpperCase();
   const mutating =
      method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
   const hasBearer = Boolean(c.req.header('authorization'));

   if (mutating && !hasBearer && getCookie(c, SESSION_COOKIE)) {
      const cookie = getCookie(c, CSRF_COOKIE);
      const header = c.req.header(CSRF_HEADER);
      if (!cookie || !header || cookie !== header) {
         throw unauthorized('CSRF token missing or invalid');
      }
   }

   await next();
};
