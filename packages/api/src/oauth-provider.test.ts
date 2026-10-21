import { describe, expect, it } from 'vitest';
import type { AppEnv } from './env';
import worker, { getOAuthProvider } from './index';

function testEnv(overrides: Partial<AppEnv> = {}): AppEnv {
   return {
      DB: {} as D1Database,
      MEDIA: {} as R2Bucket,
      AI: {} as Ai,
      ASSETS: { fetch: async () => new Response('asset') } as unknown as Fetcher,
      APP_URL: 'https://takhtabush.example.com',
      SESSION_SECRET: 's'.repeat(32),
      EMAIL_FROM: 'no-reply@example.com',
      ENVIRONMENT: 'production',
      AI_GATEWAY_URL: '',
      CLEF_MODEL: '@cf/meta/llama-3.1-8b-instruct',
      OAUTH_KV: {} as KVNamespace,
      ...overrides,
   };
}

function executionContext(): ExecutionContext {
   return {
      waitUntil: () => undefined,
      passThroughOnException: () => undefined,
   } as unknown as ExecutionContext;
}

describe('OAuth provider wiring', () => {
   it('serves flat protected-resource metadata for ChatGPT discovery', async () => {
      const res = await worker.fetch(
         new Request('https://takhtabush.example.com/.well-known/oauth-protected-resource'),
         testEnv(),
         executionContext(),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { resource: string };
      expect(body.resource).toBe('https://takhtabush.example.com/mcp');
   });

   it('publishes protected-resource metadata for the ChatGPT endpoint', async () => {
      const env = testEnv();
      const provider = getOAuthProvider(env, new Request('https://takhtabush.example.com/mcp'));

      const res = await provider.fetch(
         new Request('https://takhtabush.example.com/.well-known/oauth-protected-resource/mcp'),
         env,
         executionContext(),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
         resource: string;
         authorization_servers: string[];
      };
      expect(body.resource).toBe('https://takhtabush.example.com/mcp');
      expect(body.authorization_servers).toEqual(['https://takhtabush.example.com']);
   });

   it('treats /mcp/oauth as a descendant of the canonical resource', async () => {
      const env = testEnv();
      const provider = getOAuthProvider(
         env,
         new Request('https://takhtabush.example.com/mcp/oauth'),
      );

      const res = await provider.fetch(
         new Request('https://takhtabush.example.com/mcp/oauth', { method: 'POST' }),
         env,
         executionContext(),
      );

      expect(res.status).toBe(401);
      expect(res.headers.get('www-authenticate')).toContain(
         '/.well-known/oauth-protected-resource/mcp',
      );
   });

   it('challenges unauthenticated MCP requests with OAuth discovery', async () => {
      const env = testEnv();
      const provider = getOAuthProvider(env, new Request('https://takhtabush.example.com/mcp'));

      const res = await provider.fetch(
         new Request('https://takhtabush.example.com/mcp', { method: 'POST' }),
         env,
         executionContext(),
      );

      expect(res.status).toBe(401);
      expect(res.headers.get('www-authenticate')).toContain(
         '/.well-known/oauth-protected-resource/mcp',
      );
   });
});
