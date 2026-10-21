import { newId, nowIso } from '@caly/worker-kit';
import type { AppEnv } from '../env';

export type SessionRow = {
   id: string;
   user_id: string;
   token_hash: string;
   user_agent: string | null;
   ip_hash: string | null;
   created_at: string;
   expires_at: string;
   revoked_at: string | null;
};

export async function createSession(
   env: AppEnv,
   input: {
      userId: string;
      tokenHash: string;
      userAgent?: string;
      ipHash?: string;
      expiresAt: string;
   },
): Promise<SessionRow> {
   const id = newId('sess');
   const now = nowIso();
   await env.DB.prepare(
      `INSERT INTO sessions (id, user_id, token_hash, user_agent, ip_hash, created_at, expires_at, revoked_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
   )
      .bind(
         id,
         input.userId,
         input.tokenHash,
         input.userAgent ?? null,
         input.ipHash ?? null,
         now,
         input.expiresAt,
      )
      .run();
   return {
      id,
      user_id: input.userId,
      token_hash: input.tokenHash,
      user_agent: input.userAgent ?? null,
      ip_hash: input.ipHash ?? null,
      created_at: now,
      expires_at: input.expiresAt,
      revoked_at: null,
   };
}

export function findActiveSessionByHash(
   env: AppEnv,
   tokenHash: string,
): Promise<SessionRow | null> {
   return env.DB.prepare(
      `SELECT * FROM sessions
        WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?
        LIMIT 1`,
   )
      .bind(tokenHash, nowIso())
      .first<SessionRow>();
}

export async function revokeSession(env: AppEnv, id: string): Promise<void> {
   await env.DB.prepare('UPDATE sessions SET revoked_at = ? WHERE id = ?').bind(nowIso(), id).run();
}

export async function revokeAllSessions(env: AppEnv, userId: string): Promise<void> {
   await env.DB.prepare(
      'UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL',
   )
      .bind(nowIso(), userId)
      .run();
}

export type ActiveSessionRow = {
   id: string;
   user_agent: string | null;
   created_at: string;
   expires_at: string;
};

/** Active (unexpired, unrevoked) sessions for a user. */
export async function listActiveSessions(env: AppEnv, userId: string): Promise<ActiveSessionRow[]> {
   const result = await env.DB.prepare(
      `SELECT id, user_agent, created_at, expires_at FROM sessions
        WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ?
        ORDER BY created_at DESC`,
   )
      .bind(userId, nowIso())
      .all<ActiveSessionRow>();
   return result.results ?? [];
}

/** Revoke a single session owned by the user. Returns false when none matched. */
export async function revokeOwnedSession(
   env: AppEnv,
   userId: string,
   id: string,
): Promise<boolean> {
   const result = await env.DB.prepare(
      'UPDATE sessions SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL',
   )
      .bind(nowIso(), id, userId)
      .run();
   return (result.meta?.changes ?? 0) > 0;
}

/** Revoke every session except the current one. Returns the number revoked. */
export async function revokeOtherSessions(
   env: AppEnv,
   userId: string,
   keepId: string,
): Promise<number> {
   const result = await env.DB.prepare(
      'UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND id != ? AND revoked_at IS NULL',
   )
      .bind(nowIso(), userId, keepId)
      .run();
   return result.meta?.changes ?? 0;
}
