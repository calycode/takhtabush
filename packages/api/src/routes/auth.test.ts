import { describe, expect, it } from 'vitest';
import type { AppEnv } from '../env';
import { app } from '../index';

type Row = Record<string, unknown>;

/** Minimal in-memory D1 that understands only the auth-flow queries. */
class FakeD1 {
   users: Row[] = [];
   sessions: Row[] = [];
   magic: Row[] = [];
   rateLimits: Row[] = [];

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
      const rows = this.exec();
      return (rows[0] ?? null) as T | null;
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

      if (sql.includes('INSERT INTO magic_link_tokens')) {
         db.magic.push({
            id: p[0],
            email: p[1],
            token_hash: p[2],
            created_at: p[3],
            expires_at: p[4],
            consumed_at: null,
         });
         return [];
      }
      if (sql.includes('FROM magic_link_tokens')) {
         const [hash, now] = p as [string, string];
         return db.magic.filter(
            (m) => m.token_hash === hash && !m.consumed_at && String(m.expires_at) > now,
         );
      }
      if (sql.startsWith('UPDATE magic_link_tokens')) {
         const [consumedAt, id] = p as [string, string];
         const row = db.magic.find((m) => m.id === id);
         if (row) row.consumed_at = consumedAt;
         return [];
      }

      if (sql.includes('COUNT(*) AS count FROM users')) return [{ count: db.users.length }];
      if (sql.includes('INSERT INTO users')) {
         db.users.push({
            id: p[0],
            email: p[1],
            display_name: p[2],
            is_owner: p[3],
            created_at: p[4],
            updated_at: p[5],
         });
         return [];
      }
      if (sql.includes('FROM users WHERE email')) return db.users.filter((u) => u.email === p[0]);
      if (sql.includes('FROM users WHERE id')) return db.users.filter((u) => u.id === p[0]);
      if (sql.includes('FROM users WHERE is_owner = 1')) {
         return db.users.filter((u) => u.is_owner === 1).slice(0, 1);
      }

      if (sql.includes('INSERT INTO sessions')) {
         db.sessions.push({
            id: p[0],
            user_id: p[1],
            token_hash: p[2],
            user_agent: p[3],
            ip_hash: p[4],
            created_at: p[5],
            expires_at: p[6],
            revoked_at: null,
         });
         return [];
      }
      if (sql.includes('SELECT id, user_agent')) {
         const [userId, now] = p as [string, string];
         return db.sessions.filter(
            (s) => s.user_id === userId && !s.revoked_at && String(s.expires_at) > now,
         );
      }
      if (sql.includes('JOIN users')) {
         const [hash, now] = p as [string, string];
         const session = db.sessions.find(
            (s) => s.token_hash === hash && !s.revoked_at && String(s.expires_at) > now,
         );
         if (!session) return [];
         const user = db.users.find((u) => u.id === session.user_id);
         return user ? [{ session_id: session.id, ...user }] : [];
      }
      if (sql.includes('FROM sessions')) {
         const [hash, now] = p as [string, string];
         return db.sessions.filter(
            (s) => s.token_hash === hash && !s.revoked_at && String(s.expires_at) > now,
         );
      }
      if (sql.startsWith('UPDATE sessions')) {
         if (sql.includes('id !=')) {
            const [at, userId, keepId] = p as [string, string, string];
            for (const s of db.sessions) {
               if (s.user_id === userId && s.id !== keepId && !s.revoked_at) s.revoked_at = at;
            }
            return [];
         }
         const [at, id, userId] = p as [string, string, string | undefined];
         const row = db.sessions.find((s) => s.id === id && (!userId || s.user_id === userId));
         if (row) row.revoked_at = at;
         return [];
      }

      if (sql.startsWith('INSERT INTO rate_limits')) {
         const [bucket, windowStart] = p as [string, number];
         const row = db.rateLimits.find(
            (r) => r.bucket === bucket && r.window_start === windowStart,
         );
         if (row) row.count = Number(row.count) + 1;
         else db.rateLimits.push({ bucket, window_start: windowStart, count: 1 });
         return [];
      }
      if (sql.startsWith('SELECT count FROM rate_limits')) {
         const [bucket, windowStart] = p as [string, number];
         return db.rateLimits.filter((r) => r.bucket === bucket && r.window_start === windowStart);
      }

      return [];
   }
}

function stubEnv(overrides: Partial<AppEnv> = {}): AppEnv {
   return {
      DB: new FakeD1() as unknown as D1Database,
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

function post(path: string, body: unknown, env: AppEnv, headers: Record<string, string> = {}) {
   return app.request(
      path,
      {
         method: 'POST',
         headers: { 'content-type': 'application/json', ...headers },
         body: JSON.stringify(body),
      },
      env,
   );
}

function sidFrom(response: Response): string {
   const setCookie = response.headers.get('set-cookie') ?? '';
   const match = setCookie.match(/sid=([^;]+)/);
   if (!match) throw new Error('No session cookie set');
   return match[1];
}

function csrfFrom(response: Response): string {
   const setCookie = response.headers.get('set-cookie') ?? '';
   const match = setCookie.match(/csrf=([^;]+)/);
   if (!match) throw new Error('No CSRF cookie set');
   return match[1];
}

async function signIn(env: AppEnv, email: string): Promise<{ sid: string; csrf: string }> {
   const linkRes = await post('/api/v1/auth/magic-link', { email }, env);
   const token = ((await linkRes.json()) as { data: { devToken: string } }).data.devToken;
   const verifyRes = await post('/api/v1/auth/verify', { token }, env);
   return { sid: sidFrom(verifyRes), csrf: csrfFrom(verifyRes) };
}

describe('magic-link auth flow', () => {
   it('requests a link, verifies it, and authenticates /me', async () => {
      const env = stubEnv();

      const linkRes = await post('/api/v1/auth/magic-link', { email: 'Owner@Example.com' }, env);
      expect(linkRes.status).toBe(202);
      const link = (await linkRes.json()) as { data: { sent: true; devToken?: string } };
      expect(link.data.devToken).toBeTruthy();

      const verifyRes = await post('/api/v1/auth/verify', { token: link.data.devToken }, env);
      expect(verifyRes.status).toBe(200);
      const sid = sidFrom(verifyRes);

      const meRes = await app.request('/api/v1/me', { headers: { cookie: `sid=${sid}` } }, env);
      expect(meRes.status).toBe(200);
      const me = (await meRes.json()) as { data: { user: { email: string; isOwner: boolean } } };
      expect(me.data.user.email).toBe('owner@example.com');
      expect(me.data.user.isOwner).toBe(true);
   });

   it('rejects a reused or unknown magic-link token', async () => {
      const env = stubEnv();
      const linkRes = await post('/api/v1/auth/magic-link', { email: 'a@b.com' }, env);
      const token = ((await linkRes.json()) as { data: { devToken: string } }).data.devToken;

      expect((await post('/api/v1/auth/verify', { token }, env)).status).toBe(200);
      expect((await post('/api/v1/auth/verify', { token }, env)).status).toBe(401);
      expect((await post('/api/v1/auth/verify', { token: 'bogus' }, env)).status).toBe(401);
   });

   it('revokes the session on logout', async () => {
      const env = stubEnv();
      const linkRes = await post('/api/v1/auth/magic-link', { email: 'a@b.com' }, env);
      const token = ((await linkRes.json()) as { data: { devToken: string } }).data.devToken;
      const sid = sidFrom(await post('/api/v1/auth/verify', { token }, env));

      expect(
         (await app.request('/api/v1/me', { headers: { cookie: `sid=${sid}` } }, env)).status,
      ).toBe(200);
      const logoutRes = await app.request(
         '/api/v1/auth/logout',
         { method: 'POST', headers: { cookie: `sid=${sid}` } },
         env,
      );
      expect(logoutRes.status).toBe(204);
      expect(
         (await app.request('/api/v1/me', { headers: { cookie: `sid=${sid}` } }, env)).status,
      ).toBe(401);
   });

   it('never exposes a dev token in production and requires email', async () => {
      const env = stubEnv({ ENVIRONMENT: 'production' });
      const res = await post('/api/v1/auth/magic-link', { email: 'a@b.com' }, env);
      expect(res.status).toBe(502);
   });

   it('falls back to the request origin when APP_URL is empty', async () => {
      const sent: Array<{ html?: string }> = [];
      const env = stubEnv({
         ENVIRONMENT: 'production',
         APP_URL: '',
         EMAIL: {
            send: async (message: { html?: string }) => {
               sent.push(message);
               return { messageId: 'msg_1' };
            },
         } as unknown as SendEmail,
      });
      const res = await post('/api/v1/auth/magic-link', { email: 'a@b.com' }, env);
      expect(res.status).toBe(202);
      expect(sent[0]?.html).toContain('http://localhost/login?token=');
   });

   it('rejects an unsafe next path', async () => {
      const res = await post(
         '/api/v1/auth/magic-link',
         { email: 'a@b.com', next: '//evil.example' },
         stubEnv(),
      );
      expect(res.status).toBe(422);
   });

   it('preserves a safe next path across the magic link', async () => {
      const sent: Array<{ html?: string }> = [];
      const env = stubEnv({
         ENVIRONMENT: 'production',
         EMAIL: {
            send: async (message: { html?: string }) => {
               sent.push(message);
               return { messageId: 'msg_1' };
            },
         } as unknown as SendEmail,
      });
      const res = await post(
         '/api/v1/auth/magic-link',
         { email: 'a@b.com', next: '/oauth/authorize?client_id=chatgpt' },
         env,
      );
      expect(res.status).toBe(202);
      expect(sent[0]?.html).toContain('next=%2Foauth%2Fauthorize%3Fclient_id%3Dchatgpt');
   });

   it('sends through the EMAIL binding in production without a dev token', async () => {
      const sent: Array<{ to: unknown }> = [];
      const env = stubEnv({
         ENVIRONMENT: 'production',
         EMAIL: {
            send: async (message: { to: unknown }) => {
               sent.push(message);
               return { messageId: 'msg_1' };
            },
         } as unknown as SendEmail,
      });
      const res = await post('/api/v1/auth/magic-link', { email: 'a@b.com' }, env);
      expect(res.status).toBe(202);
      const body = (await res.json()) as { data: { devToken?: string } };
      expect(body.data.devToken).toBeUndefined();
      expect(sent).toHaveLength(1);
   });

   it('lists sessions and signs out the others', async () => {
      const env = stubEnv();
      const first = await signIn(env, 'a@b.com');
      const second = await signIn(env, 'a@b.com');

      const list = await app.request(
         '/api/v1/sessions',
         { headers: { cookie: `sid=${first.sid}` } },
         env,
      );
      const listed = (await list.json()) as { data: Array<{ current: boolean }> };
      expect(listed.data).toHaveLength(2);
      expect(listed.data.filter((s) => s.current)).toHaveLength(1);

      const others = await app.request(
         '/api/v1/sessions',
         {
            method: 'DELETE',
            headers: { cookie: `sid=${first.sid}; csrf=${first.csrf}`, 'x-csrf-token': first.csrf },
         },
         env,
      );
      expect(others.status).toBe(200);
      expect(((await others.json()) as { data: { revoked: number } }).data.revoked).toBe(1);

      expect(
         (await app.request('/api/v1/me', { headers: { cookie: `sid=${second.sid}` } }, env))
            .status,
      ).toBe(401);
   });

   it('revokes the current session and clears cookies', async () => {
      const env = stubEnv();
      const session = await signIn(env, 'a@b.com');
      const list = await app.request(
         '/api/v1/sessions',
         { headers: { cookie: `sid=${session.sid}` } },
         env,
      );
      const current = (
         (await list.json()) as { data: Array<{ id: string; current: boolean }> }
      ).data.find((s) => s.current);
      expect(current).toBeTruthy();

      const del = await app.request(
         `/api/v1/sessions/${current!.id}`,
         {
            method: 'DELETE',
            headers: {
               cookie: `sid=${session.sid}; csrf=${session.csrf}`,
               'x-csrf-token': session.csrf,
            },
         },
         env,
      );
      expect(del.status).toBe(204);
      expect(
         (await app.request('/api/v1/me', { headers: { cookie: `sid=${session.sid}` } }, env))
            .status,
      ).toBe(401);
   });

   it('rate limits repeated magic-link requests by email', async () => {
      const env = stubEnv();
      for (let i = 0; i < 5; i++) {
         expect(
            (await post('/api/v1/auth/magic-link', { email: 'spam@example.com' }, env)).status,
         ).toBe(202);
      }
      const blocked = await post('/api/v1/auth/magic-link', { email: 'spam@example.com' }, env);
      expect(blocked.status).toBe(429);
   });

   it('enforces the owner invite token when configured', async () => {
      const env = stubEnv({ OWNER_INVITE_TOKEN: 'letmein' });
      expect((await post('/api/v1/auth/magic-link', { email: 'a@b.com' }, env)).status).toBe(403);
      expect(
         (await post('/api/v1/auth/magic-link', { email: 'a@b.com', invite: 'nope' }, env)).status,
      ).toBe(403);
      expect(
         (await post('/api/v1/auth/magic-link', { email: 'a@b.com', invite: 'letmein' }, env))
            .status,
      ).toBe(202);
   });
});

describe('single tenancy and first-run setup', () => {
   it('reports whether first-run setup is required and enabled', async () => {
      const env = stubEnv();
      const res = await app.request('/api/v1/auth/status', { method: 'GET' }, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
         data: { initialized: boolean; setupRequired: boolean; setupEnabled: boolean };
      };
      expect(body.data).toEqual({
         initialized: false,
         setupRequired: true,
         setupEnabled: false,
      });

      const withToken = stubEnv({ SETUP_TOKEN: 'setup-secret' });
      const enabled = await app.request('/api/v1/auth/status', { method: 'GET' }, withToken);
      const enabledBody = (await enabled.json()) as {
         data: { initialized: boolean; setupRequired: boolean; setupEnabled: boolean };
      };
      expect(enabledBody.data.setupEnabled).toBe(true);
   });

   it('creates the owner once with the setup token', async () => {
      const env = stubEnv({ SETUP_TOKEN: 'setup-secret' });
      const res = await post(
         '/api/v1/auth/setup',
         { email: 'Owner@Example.com', token: 'setup-secret' },
         env,
      );
      expect(res.status).toBe(201);
      const sid = sidFrom(res);
      const me = await app.request('/api/v1/me', { headers: { cookie: `sid=${sid}` } }, env);
      const body = (await me.json()) as {
         data: { user: { email: string; isOwner: boolean } };
      };
      expect(body.data.user.email).toBe('owner@example.com');
      expect(body.data.user.isOwner).toBe(true);

      const recover = await post(
         '/api/v1/auth/setup',
         { email: 'owner@example.com', token: 'setup-secret' },
         env,
      );
      expect(recover.status).toBe(201);

      const other = await post(
         '/api/v1/auth/setup',
         { email: 'other@example.com', token: 'setup-secret' },
         env,
      );
      expect(other.status).toBe(403);
   });

   it('rejects setup when disabled or the token is wrong', async () => {
      const disabled = stubEnv();
      expect(
         (await post('/api/v1/auth/setup', { email: 'a@b.com', token: 'x' }, disabled)).status,
      ).toBe(403);

      const env = stubEnv({ SETUP_TOKEN: 'setup-secret' });
      expect(
         (await post('/api/v1/auth/setup', { email: 'a@b.com', token: 'wrong' }, env)).status,
      ).toBe(403);
   });

   it('blocks a second account unless it is allowlisted', async () => {
      const env = stubEnv();
      await signIn(env, 'owner@example.com');
      expect(
         (await post('/api/v1/auth/magic-link', { email: 'other@example.com' }, env)).status,
      ).toBe(403);

      const allowed = stubEnv({ ALLOWED_EMAILS: 'owner@example.com,other@example.com' });
      await signIn(allowed, 'owner@example.com');
      expect(
         (await post('/api/v1/auth/magic-link', { email: 'other@example.com' }, allowed)).status,
      ).toBe(202);
   });

   it('pins the owner email when OWNER_EMAIL is set', async () => {
      const env = stubEnv({ OWNER_EMAIL: 'owner@example.com' });
      expect(
         (await post('/api/v1/auth/magic-link', { email: 'other@example.com' }, env)).status,
      ).toBe(403);
      expect(
         (await post('/api/v1/auth/magic-link', { email: 'owner@example.com' }, env)).status,
      ).toBe(202);
   });
});
