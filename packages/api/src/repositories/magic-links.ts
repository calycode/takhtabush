import { newId, nowIso } from '@caly/worker-kit';
import type { AppEnv } from '../env';

export type MagicLinkRow = {
   id: string;
   email: string;
   token_hash: string;
   created_at: string;
   expires_at: string;
   consumed_at: string | null;
};

export async function createMagicLink(
   env: AppEnv,
   input: { email: string; tokenHash: string; expiresAt: string },
): Promise<MagicLinkRow> {
   const id = newId('mag');
   const now = nowIso();
   await env.DB.prepare(
      `INSERT INTO magic_link_tokens (id, email, token_hash, created_at, expires_at, consumed_at)
       VALUES (?, ?, ?, ?, ?, NULL)`,
   )
      .bind(id, input.email.toLowerCase(), input.tokenHash, now, input.expiresAt)
      .run();
   return {
      id,
      email: input.email.toLowerCase(),
      token_hash: input.tokenHash,
      created_at: now,
      expires_at: input.expiresAt,
      consumed_at: null,
   };
}

/** Find an unused, unexpired magic link by token hash. */
export function findValidMagicLink(env: AppEnv, tokenHash: string): Promise<MagicLinkRow | null> {
   return env.DB.prepare(
      `SELECT * FROM magic_link_tokens
        WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > ?
        LIMIT 1`,
   )
      .bind(tokenHash, nowIso())
      .first<MagicLinkRow>();
}

export async function consumeMagicLink(env: AppEnv, id: string): Promise<void> {
   await env.DB.prepare('UPDATE magic_link_tokens SET consumed_at = ? WHERE id = ?')
      .bind(nowIso(), id)
      .run();
}
