import { Hono } from 'hono';
import { createApiKeyInputSchema } from '@caly/shared';
import { ok } from '@caly/worker-kit';
import type { AppBindings } from '../env';
import { notFound } from '../lib/errors';
import { parse } from '../lib/validation';
import { createApiKey, listApiKeys, revokeApiKey } from '../services/api-key-service';

export const apiKeyRoutes = new Hono<AppBindings>()
   .get('/', async (c) => {
      const keys = await listApiKeys(c.env, c.get('user')!.id);
      return c.json(ok(keys));
   })
   .post('/', async (c) => {
      const input = parse(createApiKeyInputSchema, await c.req.json());
      const result = await createApiKey(c.env, c.get('user')!.id, input);
      return c.json(ok(result), 201);
   })
   .delete('/:id', async (c) => {
      const revoked = await revokeApiKey(c.env, c.get('user')!.id, c.req.param('id'));
      if (!revoked) throw notFound('API key not found');
      return c.body(null, 204);
   });
