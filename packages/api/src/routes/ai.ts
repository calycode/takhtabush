import { Hono } from 'hono';
import { aiEvaluationRequestSchema } from '@caly/shared';
import { ok } from '@caly/worker-kit';
import type { AppBindings } from '../env';
import { AppError } from '../lib/errors';
import { parse } from '../lib/validation';
import { evaluateCard } from '../services/ai/evaluation-service';
import { getOwnedCard } from '../services/card-service';

export const aiRoutes = new Hono<AppBindings>().post('/evaluations', async (c) => {
   const input = parse(aiEvaluationRequestSchema, await c.req.json());
   const userId = c.get('user')!.id;

   if (input.subjectType !== 'card') {
      throw new AppError('UNSUPPORTED_SUBJECT', 'Only card evaluations are supported', 422);
   }

   const card = await getOwnedCard(c.env, userId, input.subjectId);
   const evaluation = await evaluateCard(c.env, userId, card);
   return c.json(ok(evaluation), 201);
});
