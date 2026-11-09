import { Hono } from 'hono';
import { achievementSeenInputSchema } from '@caly/shared';
import { ok } from '@caly/worker-kit';
import type { AppBindings } from '../env';
import { parse } from '../lib/validation';
import {
   evaluateAchievements,
   getAchievementOverview,
   markSeen,
   shareAchievement,
} from '../services/achievement-service';

export const achievementRoutes = new Hono<AppBindings>()
   .get('/', async (c) => c.json(ok(await getAchievementOverview(c.env, c.get('user')!.id))))
   .post('/evaluate', async (c) =>
      c.json(ok({ newAchievements: await evaluateAchievements(c.env, c.get('user')!.id) })),
   )
   .post('/seen', async (c) => {
      const input = parse(achievementSeenInputSchema, await c.req.json());
      await markSeen(c.env, c.get('user')!.id, input.ids);
      return c.body(null, 204);
   })
   .post('/:id/share', async (c) =>
      c.json(
         ok({
            newAchievements: await shareAchievement(c.env, c.get('user')!.id, c.req.param('id')),
         }),
      ),
   );
