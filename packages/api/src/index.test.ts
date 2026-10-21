import { describe, expect, it } from 'vitest';
import type { AppEnv } from './env';
import { app } from './index';

function stubEnv(overrides: Partial<AppEnv> = {}): AppEnv {
   const db = {
      prepare: () => ({
         bind: () => ({
            first: async () => ({ ok: 1 }),
            run: async () => ({}),
            all: async () => ({ results: [] }),
         }),
         first: async () => ({ ok: 1 }),
         run: async () => ({}),
         all: async () => ({ results: [] }),
      }),
   };
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
      CLEF_MODEL: '@cf/meta/llama-3.1-8b-instruct',
      ...overrides,
   };
}

describe('unified worker', () => {
   it('responds to the health check', async () => {
      const res = await app.request('/api/v1/health', {}, stubEnv());
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { status: string } };
      expect(body.data.status).toBe('ok');
   });

   it('rejects unauthenticated API requests', async () => {
      const res = await app.request('/api/v1/decks', {}, stubEnv());
      expect(res.status).toBe(401);
   });

   it('serves assets for non-API paths', async () => {
      const res = await app.request('/some/spa/route', {}, stubEnv());
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('asset');
   });

   it('serves the MCP Apps study widget with the MCP Apps MIME type and CSP', async () => {
      const res = await app.request('/mcp-apps/study-session/v1.html', {}, stubEnv());
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('text/html;profile=mcp-app');
      expect(res.headers.get('content-security-policy')).toContain("default-src 'none'");
      expect(await res.text()).toContain('study session');
   });

   it('never serves the SPA for MCP Apps paths', async () => {
      const res = await app.request('/mcp-apps/unknown', {}, stubEnv());
      expect(res.status).toBe(404);
      expect(res.headers.get('content-type')).toContain('application/json');
   });

   it('never serves the SPA for API-looking paths', async () => {
      const res = await app.request('/api/v1/unknown', {}, stubEnv());
      expect(res.headers.get('content-type')).toContain('application/json');
      expect(await res.text()).not.toBe('asset');
      expect(res.status).toBe(401);
   });
});
