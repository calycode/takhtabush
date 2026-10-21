import { Hono } from 'hono';
import type { Context } from 'hono';
import { mediaCompleteInputSchema, mediaIntentInputSchema } from '@caly/shared';
import { ok } from '@caly/worker-kit';
import type { AppBindings } from '../env';
import { forbidden, notFound } from '../lib/errors';
import { parse } from '../lib/validation';
import {
   completeUpload,
   createUploadIntent,
   getMediaMetadata,
   readMediaObject,
   storeUpload,
   toMediaObject,
} from '../services/media-service';

async function createIntent(c: Context<AppBindings>) {
   const input = parse(mediaIntentInputSchema, await c.req.json());
   const result = await createUploadIntent(c.env, c.get('user')!.id, input);
   return c.json(ok(result), 201);
}

export const mediaRoutes = new Hono<AppBindings>()
   .post('/intent', createIntent)
   .put('/:id/content', async (c) => {
      const body = await c.req.arrayBuffer();
      const media = await storeUpload(
         c.env,
         c.get('user')!.id,
         c.req.param('id'),
         body,
         c.req.header('content-type'),
      );
      return c.json(ok(media));
   })
   .post('/:id/complete', async (c) => {
      const input = parse(mediaCompleteInputSchema, await c.req.json().catch(() => ({})));
      const media = await completeUpload(c.env, c.get('user')!.id, c.req.param('id'), input);
      return c.json(ok(media));
   })
   .get('/:id', async (c) => {
      const row = await getMediaMetadata(c.env, c.req.param('id'));
      if (!row) throw notFound('Media not found');
      if (String(row.owner_id) !== c.get('user')!.id) {
         throw forbidden('You do not own this media object');
      }
      return c.json(ok(toMediaObject(row)));
   })
   .get('/:id/content', async (c) => readMediaObject(c.env, c.req.param('id'), c.get('user')!.id));
