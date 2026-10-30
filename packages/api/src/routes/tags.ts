import { Hono } from 'hono';
import { z } from 'zod';
import { idSchema } from '@caly/shared';
import { ok } from '@caly/worker-kit';
import type { AppBindings } from '../env';
import { parse } from '../lib/validation';
import { listTags } from '../services/tag-service';

const tagQuerySchema = z.object({ deckId: idSchema.optional() });

export const tagRoutes = new Hono<AppBindings>().get('/', async (c) => {
   const { deckId } = parse(tagQuerySchema, c.req.query());
   const tags = await listTags(c.env, c.get('user')!.id, deckId);
   return c.json(ok(tags));
});
