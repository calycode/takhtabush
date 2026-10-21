import type { AppEnv } from '../env';
import { countUsers, getUserByEmail } from '../repositories/users';

export function normalizeEmail(email: string): string {
   return email.trim().toLowerCase();
}

/** Parse a comma-separated email list, dropping blanks and duplicates. */
export function parseEmailList(value: string | undefined): string[] {
   if (!value) return [];
   return [
      ...new Set(
         value
            .split(',')
            .map((email) => normalizeEmail(email))
            .filter(Boolean),
      ),
   ];
}

/** Emails explicitly allowed by configuration. */
export function allowedEmailSet(env: AppEnv): Set<string> {
   const allowed = new Set(parseEmailList(env.ALLOWED_EMAILS));
   if (env.OWNER_EMAIL) allowed.add(normalizeEmail(env.OWNER_EMAIL));
   return allowed;
}

/**
 * Single-tenancy gate.
 *
 * - `OWNER_EMAIL`, when set, is the only address allowed.
 * - `ALLOWED_EMAILS`, when set, is the complete allowlist for new accounts.
 * - With neither, the first user claims ownership; later addresses are blocked.
 * - Existing accounts keep working unless `OWNER_EMAIL` pins a different owner.
 */
export async function isEmailAllowed(env: AppEnv, email: string): Promise<boolean> {
   const normalized = normalizeEmail(email);
   const ownerEmail = env.OWNER_EMAIL ? normalizeEmail(env.OWNER_EMAIL) : null;
   if (ownerEmail && normalized !== ownerEmail) return false;

   const existing = await getUserByEmail(env, normalized);
   if (existing) return true;

   const allowed = allowedEmailSet(env);
   if (allowed.has(normalized)) return true;
   if (allowed.size > 0) return false;

   const users = await countUsers(env);
   return users === 0;
}

export type AuthStatus = {
   initialized: boolean;
   setupRequired: boolean;
   setupEnabled: boolean;
};

export async function getAuthStatus(env: AppEnv): Promise<AuthStatus> {
   const users = await countUsers(env);
   return {
      initialized: users > 0,
      setupRequired: users === 0,
      setupEnabled: Boolean(env.SETUP_TOKEN),
   };
}
