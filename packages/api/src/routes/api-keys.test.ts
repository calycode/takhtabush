import { describe, expect, it } from 'vitest';
import type { AppEnv } from '../env';
import { app } from '../index';
import { createApiKey } from '../services/api-key-service';

type Row = Record<string, unknown>;

class FakeD1 {
   users: Row[] = [];
   apiKeys: Row[] = [];

   prepare(sql: string) {
      return new FakeStatement(this, sql);
   }
}

class FakeStatement {
   private params: unknown[] = [];

   constructor(
      private readonly db: FakeD1,
      private readonly sql: string,
   ) {}

   bind(...args: unknown[]) {
      this.params = args;
      return this;
   }

   async first<T>() {
      return (this.exec()[0] ?? null) as T | null;
   }

   async all<T>() {
      return { results: this.exec() as T[] };
   }

   async run() {
      this.exec();
      return { meta: { changes: 1 } };
   }

   private exec(): Row[] {
      const sql = this.sql;
      const p = this.params;
      const db = this.db;

      if (sql.includes('INSERT INTO api_keys')) {
         db.apiKeys.push({
            id: p[0],
            user_id: p[1],
            name: p[2],
            key_prefix: p[3],
            key_hash: p[4],
            scopes_json: p[5],
            created_at: p[6],
            expires_at: p[7],
            last_used_at: null,
            revoked_at: null,
         });
         return [];
      }
      if (sql.includes('FROM api_keys') && sql.includes('key_hash')) {
         const now = p[1] as string;
         return db.apiKeys.filter(
            (k) =>
               k.key_hash === p[0] &&
               !k.revoked_at &&
               (!k.expires_at || String(k.expires_at) > now),
         );
      }
      if (sql.includes('FROM api_keys WHERE id')) return db.apiKeys.filter((k) => k.id === p[0]);
      if (sql.includes('FROM api_keys WHERE user_id')) {
         return db.apiKeys.filter((k) => k.user_id === p[0] && !k.revoked_at);
      }
      if (sql.startsWith('UPDATE api_keys')) return [];

      if (sql.includes('FROM users WHERE id')) return db.users.filter((u) => u.id === p[0]);
      if (sql.includes('FROM users WHERE email')) return db.users.filter((u) => u.email === p[0]);
      if (sql.includes('FROM users WHERE is_owner = 1')) {
         return db.users.filter((u) => u.is_owner === 1).slice(0, 1);
      }
      if (sql.includes('FROM sessions')) return [];

      return [];
   }
}

function authEnv(overrides: Partial<AppEnv> = {}): AppEnv {
   const db = new FakeD1();
   db.users.push({
      id: 'usr_1',
      email: 'a@b.com',
      display_name: 'A',
      is_owner: 1,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
   });
   return {
      DB: db as unknown as D1Database,
      MEDIA: {} as unknown as R2Bucket,
      AI: {} as unknown as Ai,
      ASSETS: { fetch: async () => new Response('asset') } as unknown as Fetcher,
      APP_URL: 'http://localhost:8787',
      SESSION_SECRET: 'test-secret',
      EMAIL_FROM: 'no-reply@test.local',
      ENVIRONMENT: 'development',
      AI_GATEWAY_URL: '',
      CLEF_MODEL: '@cf/models/llama',
      ...overrides,
   };
}

function rpc(method: string, params: unknown, apiKey: string, env: AppEnv) {
   return app.request(
      '/mcp',
      {
         method: 'POST',
         headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
         body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      },
      env,
   );
}

function noAuthRpc(method: string, params: unknown, env: AppEnv) {
   return app.request(
      '/mcp',
      {
         method: 'POST',
         headers: { 'content-type': 'application/json' },
         body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      },
      env,
   );
}

describe('MCP API-key auth', () => {
   it('authenticates /mcp with an API key and lists tools', async () => {
      const env = authEnv();
      const { secret } = await createApiKey(env, 'usr_1', {
         name: 'agent',
         scopes: ['decks:read', 'stats:read'],
      });

      const res = await rpc('tools/list', {}, secret, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { result: { tools: Array<{ name: string }> } };
      expect(body.result.tools).toHaveLength(7);
      expect(body.result.tools.map((tool) => tool.name)).not.toContain('create_deck');
   });

   it('rejects writes outside the key scopes', async () => {
      const env = authEnv();
      const { secret } = await createApiKey(env, 'usr_1', {
         name: 'reader',
         scopes: ['decks:read'],
      });

      const res = await rpc(
         'tools/call',
         { name: 'create_deck', arguments: { title: 'x' } },
         secret,
         env,
      );
      const body = (await res.json()) as { error: { code: number } };
      expect(body.error.code).toBe(-32003);
   });

   it('rejects an unknown API key', async () => {
      const env = authEnv();
      const res = await rpc('tools/list', {}, 'fck_bogus', env);
      expect(res.status).toBe(401);
   });

   it('accepts a key before expiry and rejects it after', async () => {
      const env = authEnv();
      const { secret } = await createApiKey(env, 'usr_1', {
         name: 'expiring',
         scopes: ['decks:read'],
         expiresInDays: 1,
      });

      expect((await rpc('tools/list', {}, secret, env)).status).toBe(200);

      const db = env.DB as unknown as { apiKeys: Array<Record<string, unknown>> };
      db.apiKeys[0].expires_at = new Date(Date.now() - 1000).toISOString();

      expect((await rpc('tools/list', {}, secret, env)).status).toBe(401);
   });

   it('bypasses MCP auth in development when MCP_DEV_NO_AUTH is enabled', async () => {
      const env = authEnv({ MCP_DEV_NO_AUTH: 'true' });
      const res = await noAuthRpc('tools/list', {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { result: { tools: unknown[] } };
      expect(body.result.tools).toHaveLength(15);
   });

   it('ignores MCP_DEV_NO_AUTH in production', async () => {
      const env = authEnv({ ENVIRONMENT: 'production', MCP_DEV_NO_AUTH: 'true' });
      expect((await noAuthRpc('tools/list', {}, env)).status).toBe(401);
   });

   it('does not let a bad API key fall back to the development user', async () => {
      const env = authEnv({ MCP_DEV_NO_AUTH: 'true' });
      expect((await rpc('tools/list', {}, 'fck_bogus', env)).status).toBe(401);
   });

   it('reports a missing owner when MCP development auth is enabled', async () => {
      const env = authEnv({ MCP_DEV_NO_AUTH: 'true' });
      const db = env.DB as unknown as { users: Array<Record<string, unknown>> };
      db.users.length = 0;
      expect((await noAuthRpc('tools/list', {}, env)).status).toBe(503);
   });
});
