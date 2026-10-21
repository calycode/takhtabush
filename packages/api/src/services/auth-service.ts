import { newId } from '@caly/worker-kit';
import type { User } from '@caly/shared';
import type { AppEnv } from '../env';
import { AppError, forbidden } from '../lib/errors';
import { hashToken, randomToken, sha256Hex, timingSafeEqual } from '../lib/crypto';
import { sendMagicLink } from './email-service';
import { consumeMagicLink, createMagicLink, findValidMagicLink } from '../repositories/magic-links';
import {
   createSession,
   listActiveSessions,
   revokeOtherSessions,
   revokeOwnedSession,
   revokeSession,
} from '../repositories/sessions';
import {
   countUsers,
   getOwner,
   getUserByEmail,
   insertUser,
   mapUserRow,
   type UserRow,
} from '../repositories/users';
import { isEmailAllowed, normalizeEmail } from './tenancy';

export const MAGIC_LINK_TTL_MINUTES = 15;
export const SESSION_TTL_DAYS = 30;

export type RequestMagicLinkResult = { sent: true; devToken?: string };

/** Dev tokens are never exposed in production (SPEC §3.2). */
export function shouldExposeDevToken(env: AppEnv): boolean {
   return env.ENVIRONMENT !== 'production';
}

/**
 * Request a sign-in link. In production a working `EMAIL` binding is required;
 * in development the raw token is returned (and logged) so sign-in works
 * without an email provider.
 */
export async function requestMagicLink(
   env: AppEnv,
   email: string,
   invite?: string,
   origin?: string,
   next?: string,
): Promise<RequestMagicLinkResult> {
   if (env.OWNER_INVITE_TOKEN) {
      if (!invite || !timingSafeEqual(invite, env.OWNER_INVITE_TOKEN)) {
         throw forbidden('A valid invite token is required');
      }
   }

   if (!(await isEmailAllowed(env, email))) {
      throw forbidden('This deployment only allows the owner account');
   }

   const token = randomToken(32);
   const tokenHash = await hashToken(env.SESSION_SECRET, token);
   const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MINUTES * 60_000).toISOString();
   await createMagicLink(env, { email, tokenHash, expiresAt });

   // APP_URL is optional for repository installs; the request origin is the
   // correct fallback until a custom domain is pinned.
   const baseUrl = (env.APP_URL || origin || '').replace(/\/$/, '');
   const nextPath =
      next && next.startsWith('/') && !next.startsWith('//') && !next.includes('\\')
         ? next
         : undefined;
   const link = `${baseUrl}/login?token=${encodeURIComponent(token)}${
      nextPath ? `&next=${encodeURIComponent(nextPath)}` : ''
   }`;
   const delivery = await sendMagicLink(env, email, link);

   if (!shouldExposeDevToken(env)) {
      if (!delivery.delivered) {
         throw new AppError(
            'EMAIL_DELIVERY_FAILED',
            delivery.error?.message ?? 'Could not send the sign-in email',
            502,
         );
      }
      return { sent: true };
   }

   // Development: always surface the token so sign-in works without a mailbox.
   return { sent: true, devToken: token };
}

export type VerifyResult = {
   user: User;
   sessionToken: string;
   expiresAt: string;
};

async function createSessionForUser(
   env: AppEnv,
   userRow: UserRow,
   meta: { userAgent?: string; ip?: string },
): Promise<VerifyResult> {
   const sessionToken = randomToken(32);
   const sessionHash = await hashToken(env.SESSION_SECRET, sessionToken);
   const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000).toISOString();
   const ipHash = meta.ip ? await sha256Hex(`${env.SESSION_SECRET}:ip:${meta.ip}`) : undefined;

   await createSession(env, {
      userId: userRow.id,
      tokenHash: sessionHash,
      userAgent: meta.userAgent,
      ipHash,
      expiresAt,
   });

   return { user: mapUserRow(userRow), sessionToken, expiresAt };
}

export async function verifyMagicLink(
   env: AppEnv,
   token: string,
   meta: { userAgent?: string; ip?: string },
): Promise<VerifyResult> {
   const tokenHash = await hashToken(env.SESSION_SECRET, token);
   const link = await findValidMagicLink(env, tokenHash);
   if (!link) throw new AppError('INVALID_TOKEN', 'Magic link is invalid or expired', 401);
   await consumeMagicLink(env, link.id);

   if (!(await isEmailAllowed(env, link.email))) {
      throw forbidden('This deployment only allows the owner account');
   }

   let userRow: UserRow | null = await getUserByEmail(env, link.email);
   if (!userRow) {
      const existing = await countUsers(env);
      userRow = await insertUser(env, {
         email: link.email,
         displayName: link.email.split('@')[0] ?? 'Learner',
         isOwner: existing === 0,
      });
   }

   return createSessionForUser(env, userRow, meta);
}

/**
 * First-run setup. Creates the owner account without sending email, which is
 * what a catalog install needs before its sender domain is configured.
 */
export async function setupOwner(
   env: AppEnv,
   email: string,
   token: string,
   meta: { userAgent?: string; ip?: string },
): Promise<VerifyResult> {
   if (!env.SETUP_TOKEN) {
      throw forbidden('First-run setup is not enabled');
   }
   if (!timingSafeEqual(token, env.SETUP_TOKEN)) {
      throw forbidden('Invalid setup token');
   }

   const normalized = normalizeEmail(email);
   if (!(await isEmailAllowed(env, normalized))) {
      throw forbidden('This email is not allowed to own this deployment');
   }

   const users = await countUsers(env);
   if (users > 0) {
      const owner = await getOwner(env);
      if (!owner || normalizeEmail(owner.email) !== normalized) {
         throw forbidden('This deployment is already set up');
      }
      return createSessionForUser(env, owner, meta);
   }

   let userRow: UserRow;
   try {
      userRow = await insertUser(env, {
         email: normalized,
         displayName: normalized.split('@')[0] ?? 'Owner',
         isOwner: true,
      });
   } catch (cause) {
      const existing = await getUserByEmail(env, normalized);
      if (existing) return createSessionForUser(env, existing, meta);
      throw cause;
   }

   return createSessionForUser(env, userRow, meta);
}

export async function logout(env: AppEnv, sessionId: string | undefined): Promise<void> {
   if (sessionId) await revokeSession(env, sessionId);
}

export type SessionInfo = {
   id: string;
   userAgent: string | null;
   createdAt: string;
   expiresAt: string;
   current: boolean;
};

export async function listSessions(
   env: AppEnv,
   userId: string,
   currentId: string | undefined,
): Promise<SessionInfo[]> {
   const rows = await listActiveSessions(env, userId);
   return rows.map((row) => ({
      id: row.id,
      userAgent: row.user_agent,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      current: row.id === currentId,
   }));
}

export function revokeUserSession(env: AppEnv, userId: string, id: string): Promise<boolean> {
   return revokeOwnedSession(env, userId, id);
}

export function revokeOtherUserSessions(
   env: AppEnv,
   userId: string,
   currentId: string,
): Promise<number> {
   return revokeOtherSessions(env, userId, currentId);
}

/** Fresh CSRF token for the double-submit cookie (SPEC §3.2). */
export function issueCsrfToken(): string {
   return newId('tok');
}
