import { Hono } from 'hono';
import { updateMeInputSchema } from '@caly/shared';
import { ok } from '@caly/worker-kit';
import type { AppBindings } from '../env';
import { parse } from '../lib/validation';
import { setCsrfCookie } from '../middleware/auth';
import { getUserById, mapUserRow, updateUser } from '../repositories/users';

export const meRoutes = new Hono<AppBindings>()
   .get('/', (c) => {
      const csrfToken = c.get('csrfToken');
      if (!csrfToken) setCsrfCookie(c);
      return c.json(
         ok({
            user: c.get('user'),
            csrfToken: c.get('csrfToken') ?? '',
         }),
      );
   })
   .patch('/', async (c) => {
      const input = parse(updateMeInputSchema, await c.req.json());
      const current = c.get('user')!;
      const row = input.displayName
         ? await updateUser(c.env, current.id, { displayName: input.displayName })
         : await getUserById(c.env, current.id);
      return c.json(ok({ user: row ? mapUserRow(row) : current }));
   });
