import type { ApiKey, CreateApiKeyInput, CreateApiKeyResponse, McpScope } from '@caly/shared';
import type { AppEnv } from '../env';
import { hashToken, randomToken } from '../lib/crypto';
import {
   getApiKeyByHash,
   insertApiKey,
   listApiKeyRows,
   mapApiKey,
   revokeApiKeyRow,
} from '../repositories/api-keys';

export const API_KEY_PREFIX = 'fck_';

export async function listApiKeys(env: AppEnv, userId: string): Promise<ApiKey[]> {
   const rows = await listApiKeyRows(env, userId);
   return rows.map(mapApiKey);
}

export async function createApiKey(
   env: AppEnv,
   userId: string,
   input: CreateApiKeyInput,
): Promise<CreateApiKeyResponse> {
   const secret = `${API_KEY_PREFIX}${randomToken(24)}`;
   const keyHash = await hashToken(env.SESSION_SECRET, secret);
   const expiresAt = input.expiresInDays
      ? new Date(Date.now() + input.expiresInDays * 86_400_000).toISOString()
      : null;
   const row = await insertApiKey(env, {
      userId,
      name: input.name,
      keyPrefix: secret.slice(0, 12),
      keyHash,
      scopes: input.scopes,
      expiresAt,
   });
   return { apiKey: mapApiKey(row), secret };
}

export function revokeApiKey(env: AppEnv, userId: string, id: string): Promise<boolean> {
   return revokeApiKeyRow(env, userId, id);
}

export type ResolvedApiKey = { id: string; userId: string; scopes: McpScope[] };

/** Resolve a raw API key to its owner and scopes. Returns null when invalid. */
export async function resolveApiKey(env: AppEnv, secret: string): Promise<ResolvedApiKey | null> {
   const keyHash = await hashToken(env.SESSION_SECRET, secret);
   const row = await getApiKeyByHash(env, keyHash);
   if (!row) return null;
   return { id: row.id, userId: row.user_id, scopes: mapApiKey(row).scopes };
}
