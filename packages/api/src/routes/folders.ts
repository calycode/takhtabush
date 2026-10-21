import { Hono } from 'hono';
import { createFolderInputSchema, updateFolderInputSchema } from '@caly/shared';
import { ok } from '@caly/worker-kit';
import type { AppBindings } from '../env';
import { parse } from '../lib/validation';
import {
   createFolder,
   listUserFolders,
   patchFolder,
   removeFolder,
} from '../services/folder-service';

export const folderRoutes = new Hono<AppBindings>()
   .get('/', async (c) => {
      const folders = await listUserFolders(c.env, c.get('user')!.id);
      return c.json(ok(folders));
   })
   .post('/', async (c) => {
      const input = parse(createFolderInputSchema, await c.req.json());
      const folder = await createFolder(c.env, c.get('user')!.id, input);
      return c.json(ok(folder), 201);
   })
   .patch('/:id', async (c) => {
      const input = parse(updateFolderInputSchema, await c.req.json());
      const folder = await patchFolder(c.env, c.get('user')!.id, c.req.param('id'), input);
      return c.json(ok(folder));
   })
   .delete('/:id', async (c) => {
      await removeFolder(c.env, c.get('user')!.id, c.req.param('id'));
      return c.body(null, 204);
   });
