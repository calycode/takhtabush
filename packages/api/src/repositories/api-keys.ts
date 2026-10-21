import type { McpScope } from '@caly/shared';
import { newId, nowIso } from '@caly/worker-kit';
import type { AppEnv } from '../env';

export type ApiKeyRow = {
   id: string;
   user_id: string;
   name: string;
   key_prefix: string;
   key_hash: string;
   scopes_json: string;
   created_at: string;
   expires_at: string | null;
   last_used_at: string | null;
   revoked_at: string | null;
};

export function mapApiKey(row: ApiKeyRow) {
   return {
      id: row.id,
      name: row.name,
      keyPrefix: row.key_prefix,
      scopes: JSON.parse(row.scopes_json || '[]') as McpScope[],
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      lastUsedAt: row.last_used_at,
      revokedAt: row.revoked_at,
   };
}

/** Find an active (unrevoked, unexpired) key by hash. */
export function getApiKeyByHash(env: AppEnv, keyHash: string): Promise<ApiKeyRow | null> {
   return env.DB.prepare(
      `SELECT * FROM api_keys
        WHERE key_hash = ? AND revoked_at IS NULL
          AND (expires_at IS NULL OR expires_at > ?)
        LIMIT 1`,
   )
      .bind(keyHash, nowIso())
      .first<ApiKeyRow>();
}

export async function listApiKeyRows(env: AppEnv, userId: string): Promise<ApiKeyRow[]> {
   const result = await env.DB.prepare(
      'SELECT * FROM api_keys WHERE user_id = ? AND revoked_at IS NULL ORDER BY created_at DESC',
   )
      .bind(userId)
      .all<ApiKeyRow>();
   return result.results ?? [];
}

export async function insertApiKey(
   env: AppEnv,
   input: {
      userId: string;
      name: string;
      keyPrefix: string;
      keyHash: string;
      scopes: McpScope[];
      expiresAt: string | null;
   },
): Promise<ApiKeyRow> {
   const id = newId('tok');
   const now = nowIso();
   await env.DB.prepare(
      `INSERT INTO api_keys (id, user_id, name, key_prefix, key_hash, scopes_json, created_at, expires_at, last_used_at, revoked_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
   )
      .bind(
         id,
         input.userId,
         input.name,
         input.keyPrefix,
         input.keyHash,
         JSON.stringify(input.scopes),
         now,
         input.expiresAt,
      )
      .run();
   const row = await env.DB.prepare('SELECT * FROM api_keys WHERE id = ?')
      .bind(id)
      .first<ApiKeyRow>();
   if (!row) throw new Error('Failed to create API key');
   return row;
}

export async function revokeApiKeyRow(env: AppEnv, userId: string, id: string): Promise<boolean> {
   const result = await env.DB.prepare(
      'UPDATE api_keys SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL',
   )
      .bind(nowIso(), id, userId)
      .run();
   return (result.meta?.changes ?? 0) > 0;
}

export async function touchApiKey(env: AppEnv, id: string): Promise<void> {
   await env.DB.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?')
      .bind(nowIso(), id)
      .run();
}
