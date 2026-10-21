import { Hono } from 'hono';
import { ok } from '@caly/worker-kit';
import type { AppBindings } from '../env';
import { notFound } from '../lib/errors';
import { clearCsrfCookie, clearSessionCookie } from '../middleware/auth';
import { listSessions, revokeOtherUserSessions, revokeUserSession } from '../services/auth-service';

export const sessionRoutes = new Hono<AppBindings>()
   .get('/', async (c) => {
      const sessions = await listSessions(c.env, c.get('user')!.id, c.get('sessionId'));
      return c.json(ok(sessions));
   })
   .delete('/:id', async (c) => {
      const id = c.req.param('id');
      const userId = c.get('user')!.id;
      const revoked = await revokeUserSession(c.env, userId, id);
      if (!revoked) throw notFound('Session not found');
      if (id === c.get('sessionId')) {
         clearSessionCookie(c);
         clearCsrfCookie(c);
      }
      return c.body(null, 204);
   })
   .delete('/', async (c) => {
      const currentId = c.get('sessionId') ?? '';
      const revoked = await revokeOtherUserSessions(c.env, c.get('user')!.id, currentId);
      return c.json(ok({ revoked }));
   });
