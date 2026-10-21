import { Hono } from 'hono';
import {
   requestMagicLinkInputSchema,
   setupOwnerInputSchema,
   verifyMagicLinkInputSchema,
} from '@caly/shared';
import { ok } from '@caly/worker-kit';
import type { AppBindings } from '../env';
import { parse } from '../lib/validation';
import { clientIp, enforceRateLimit } from '../lib/rate-limit';
import {
   clearCsrfCookie,
   clearSessionCookie,
   setCsrfCookie,
   setSessionCookie,
} from '../middleware/auth';
import { logout, requestMagicLink, setupOwner, verifyMagicLink } from '../services/auth-service';
import { getAuthStatus } from '../services/tenancy';

export const authRoutes = new Hono<AppBindings>()
   .get('/status', async (c) => c.json(ok(await getAuthStatus(c.env))))
   .post('/setup', async (c) => {
      await enforceRateLimit(c.env, `auth:setup:ip:${clientIp(c)}`, 5, 600);
      const input = parse(setupOwnerInputSchema, await c.req.json());
      const result = await setupOwner(c.env, input.email, input.token, {
         userAgent: c.req.header('user-agent'),
         ip: c.req.header('cf-connecting-ip'),
      });
      setSessionCookie(c, result.sessionToken, result.expiresAt);
      setCsrfCookie(c);
      return c.json(ok({ user: result.user }), 201);
   })
   .post('/magic-link', async (c) => {
      await enforceRateLimit(c.env, `auth:magic:ip:${clientIp(c)}`, 10, 600);
      const input = parse(requestMagicLinkInputSchema, await c.req.json());
      await enforceRateLimit(c.env, `auth:magic:email:${input.email.toLowerCase()}`, 5, 900);
      const result = await requestMagicLink(
         c.env,
         input.email,
         input.invite,
         new URL(c.req.url).origin,
         input.next,
      );
      return c.json(ok(result), 202);
   })
   .post('/verify', async (c) => {
      await enforceRateLimit(c.env, `auth:verify:ip:${clientIp(c)}`, 20, 600);
      const input = parse(verifyMagicLinkInputSchema, await c.req.json());
      const result = await verifyMagicLink(c.env, input.token, {
         userAgent: c.req.header('user-agent'),
         ip: c.req.header('cf-connecting-ip'),
      });
      setSessionCookie(c, result.sessionToken, result.expiresAt);
      setCsrfCookie(c);
      return c.json(ok({ user: result.user }));
   })
   .post('/logout', async (c) => {
      await logout(c.env, c.get('sessionId'));
      clearSessionCookie(c);
      clearCsrfCookie(c);
      return c.body(null, 204);
   });
