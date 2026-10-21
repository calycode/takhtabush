import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import type { OAuthHelpers } from '@cloudflare/workers-oauth-provider';
import type { User } from '@caly/shared';
import type { AppBindings, AppEnv } from '../env';
import { oauthRoutes } from './oauth';

const USER: User = {
   id: 'usr_1',
   email: 'owner@example.com',
   displayName: 'Owner',
   isOwner: true,
   createdAt: '2026-01-01T00:00:00.000Z',
   updatedAt: '2026-01-01T00:00:00.000Z',
};

function fakeOAuth(overrides: Partial<OAuthHelpers> = {}): OAuthHelpers {
   return {
      parseAuthRequest: async () => ({ scope: ['decks:read'] }),
      isConsentRemembered: async () => false,
      describeConsent: async () => ({
         clientId: 'https://chatgpt.com/oauth/client.json',
         clientName: 'ChatGPT',
         clientDomain: 'chatgpt.com',
         redirectUri: 'https://chatgpt.com/connector_platform_oauth_redirect',
         redirectHost: 'chatgpt.com',
         redirectIsLoopback: false,
         scope: ['decks:read'],
      }),
      beginConsent: async () => ({
         handle: 'handle_1',
         headers: new Headers({
            'set-cookie': '__Host-oauth-consent=bind; Path=/',
            'x-frame-options': 'DENY',
         }),
      }),
      approveConsent: async () => ({
         request: { scope: ['decks:read'] },
         headers: new Headers({ 'set-cookie': '__Host-oauth-consent=; Max-Age=0' }),
      }),
      denyConsent: async () => ({
         request: { scope: ['decks:read'] },
         redirectTo: 'https://chatgpt.com/callback?error=access_denied',
         headers: new Headers({
            location: 'https://chatgpt.com/callback?error=access_denied',
         }),
      }),
      completeAuthorization: async () => ({
         redirectTo: 'https://chatgpt.com/callback?code=abc',
      }),
      ...overrides,
   } as unknown as OAuthHelpers;
}

function env(overrides: Partial<AppEnv> = {}): AppEnv {
   return {
      SESSION_SECRET: 's'.repeat(32),
      APP_URL: 'https://takhtabush.example.com',
      ...overrides,
   } as AppEnv;
}

function signedInApp(): Hono<AppBindings> {
   const app = new Hono<AppBindings>();
   app.use('*', async (c, next) => {
      c.set('user', USER);
      await next();
   });
   app.route('/oauth', oauthRoutes);
   return app;
}

describe('OAuth authorize route', () => {
   it('returns 503 when the OAuth provider is not configured', async () => {
      const res = await oauthRoutes.request('/authorize', {}, env());
      expect(res.status).toBe(503);
   });

   it('redirects a signed-out user through the existing login flow', async () => {
      const res = await oauthRoutes.request(
         '/authorize?client_id=chatgpt&state=xyz',
         {},
         env({ OAUTH_PROVIDER: fakeOAuth() }),
      );

      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toContain('/login?next=');
      expect(res.headers.get('location')).toContain('authorize');
   });

   it('renders consent with the client, host, and scopes', async () => {
      const res = await signedInApp().request(
         '/oauth/authorize?client_id=chatgpt',
         {},
         env({ OAUTH_PROVIDER: fakeOAuth() }),
      );

      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('ChatGPT');
      expect(html).toContain('chatgpt.com');
      expect(html).toContain('decks:read');
      expect(res.headers.get('set-cookie')).toContain('__Host-oauth-consent');
      expect(res.headers.get('x-frame-options')).toBe('DENY');
   });

   it('completes authorization after consent', async () => {
      const res = await signedInApp().request(
         '/oauth/authorize',
         {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ handle: 'handle_1', decision: 'approve' }).toString(),
         },
         env({ OAUTH_PROVIDER: fakeOAuth() }),
      );

      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBe('https://chatgpt.com/callback?code=abc');
   });

   it('returns the client redirect on deny', async () => {
      const res = await signedInApp().request(
         '/oauth/authorize',
         {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ handle: 'handle_1', decision: 'deny' }).toString(),
         },
         env({ OAUTH_PROVIDER: fakeOAuth() }),
      );

      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toContain('error=access_denied');
   });
});
