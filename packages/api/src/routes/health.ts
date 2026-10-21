import { Hono } from 'hono';
import { ok } from '@caly/worker-kit';
import type { AppBindings } from '../env';

export const healthRoutes = new Hono<AppBindings>().get('/', async (c) => {
   let database = 'ok';
   try {
      await c.env.DB.prepare('SELECT 1').first();
   } catch {
      database = 'unavailable';
   }
   return c.json(
      ok({ status: database === 'ok' ? 'ok' : 'degraded', version: 'v1', database }),
      database === 'ok' ? 200 : 503,
   );
});
