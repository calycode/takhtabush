import { Hono } from 'hono';
import { updateCardInputSchema } from '@caly/shared';
import { ok } from '@caly/worker-kit';
import type { AppBindings } from '../env';
import { parse } from '../lib/validation';
import {
   getOwnedCard,
   patchCard,
   removeCard,
   restoreCard,
   setCardSuspended,
} from '../services/card-service';

export const cardRoutes = new Hono<AppBindings>()
   .get('/:id', async (c) => {
      const card = await getOwnedCard(c.env, c.get('user')!.id, c.req.param('id'));
      return c.json(ok(card));
   })
   .patch('/:id', async (c) => {
      const input = parse(updateCardInputSchema, await c.req.json());
      const card = await patchCard(c.env, c.get('user')!.id, c.req.param('id'), input);
      return c.json(ok(card));
   })
   .post('/:id/suspend', async (c) => {
      const card = await setCardSuspended(c.env, c.get('user')!.id, c.req.param('id'), true);
      return c.json(ok(card));
   })
   .post('/:id/resume', async (c) => {
      const card = await setCardSuspended(c.env, c.get('user')!.id, c.req.param('id'), false);
      return c.json(ok(card));
   })
   .post('/:id/restore', async (c) => {
      const card = await restoreCard(c.env, c.get('user')!.id, c.req.param('id'));
      return c.json(ok(card));
   })
   .delete('/:id', async (c) => {
      await removeCard(c.env, c.get('user')!.id, c.req.param('id'));
      return c.body(null, 204);
   });
