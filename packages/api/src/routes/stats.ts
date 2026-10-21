import { Hono } from 'hono';
import { ok } from '@caly/worker-kit';
import type { AppBindings } from '../env';
import { computeDeckStats } from '../services/stats-service';

export const statsRoutes = new Hono<AppBindings>().get('/decks/:id', async (c) => {
   const stats = await computeDeckStats(c.env, c.get('user')!.id, c.req.param('id'));
   return c.json(ok(stats));
});
