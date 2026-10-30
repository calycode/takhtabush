import { Hono } from 'hono';
import { createCollectionInputSchema, updateCollectionInputSchema } from '@caly/shared';
import { ok } from '@caly/worker-kit';
import type { AppBindings } from '../env';
import { parse } from '../lib/validation';
import {
   createCollection,
   listUserCollections,
   patchCollection,
   removeCollection,
} from '../services/collection-service';

export const collectionRoutes = new Hono<AppBindings>()
   .get('/', async (c) => {
      const collections = await listUserCollections(c.env, c.get('user')!.id);
      return c.json(ok(collections));
   })
   .post('/', async (c) => {
      const input = parse(createCollectionInputSchema, await c.req.json());
      const collection = await createCollection(c.env, c.get('user')!.id, input);
      return c.json(ok(collection), 201);
   })
   .patch('/:id', async (c) => {
      const input = parse(updateCollectionInputSchema, await c.req.json());
      const collection = await patchCollection(c.env, c.get('user')!.id, c.req.param('id'), input);
      return c.json(ok(collection));
   })
   .delete('/:id', async (c) => {
      await removeCollection(c.env, c.get('user')!.id, c.req.param('id'));
      return c.body(null, 204);
   });
