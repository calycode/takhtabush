import { Hono } from 'hono';
import { ok } from '@caly/worker-kit';
import type { AppBindings } from '../env';
import { listTags } from '../services/tag-service';

export const tagRoutes = new Hono<AppBindings>().get('/', async (c) => {
   const tags = await listTags(c.env, c.get('user')!.id);
   return c.json(ok(tags));
});
