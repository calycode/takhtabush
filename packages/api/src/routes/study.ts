import { Hono } from 'hono';
import { z } from 'zod';
import {
   idSchema,
   listStudySessionsQuerySchema,
   reviewEventInputSchema,
   startSessionInputSchema,
   studyGoalSchema,
   studyModeSchema,
   studyPreviewInputSchema,
} from '@caly/shared';
import { ok } from '@caly/worker-kit';
import type { AppBindings } from '../env';
import { parse } from '../lib/validation';
import {
   abandonSession,
   completeSession,
   getSessionDetail,
   listSessions,
   previewStudy,
   recommendStudyPlan,
   recordReview,
   startSession,
} from '../services/study-service';

const recommendationQuerySchema = z.object({
   deckId: idSchema,
   minutes: z.coerce.number().int().min(1).max(180).default(15),
   goal: studyGoalSchema.default('learn'),
   mode: studyModeSchema.default('flashcards'),
});

export const studyRoutes = new Hono<AppBindings>()
   .post('/preview', async (c) => {
      const input = parse(studyPreviewInputSchema, await c.req.json());
      const preview = await previewStudy(c.env, c.get('user')!.id, input);
      return c.json(ok(preview));
   })
   .get('/sessions', async (c) => {
      const query = parse(listStudySessionsQuerySchema, c.req.query());
      const sessions = await listSessions(c.env, c.get('user')!.id, query);
      return c.json(ok(sessions));
   })
   .post('/sessions', async (c) => {
      const input = parse(startSessionInputSchema, await c.req.json());
      const result = await startSession(c.env, c.get('user')!.id, input, 'user');
      return c.json(ok(result), 201);
   })
   .get('/sessions/:id', async (c) => {
      const session = await getSessionDetail(c.env, c.get('user')!.id, c.req.param('id'));
      return c.json(ok(session));
   })
   .post('/sessions/:id/reviews', async (c) => {
      const input = parse(reviewEventInputSchema, await c.req.json());
      const result = await recordReview(c.env, c.get('user')!.id, c.req.param('id'), input);
      return c.json(ok(result), 201);
   })
   .post('/sessions/:id/complete', async (c) => {
      const session = await completeSession(c.env, c.get('user')!.id, c.req.param('id'));
      return c.json(ok(session));
   })
   .post('/sessions/:id/abandon', async (c) => {
      const session = await abandonSession(c.env, c.get('user')!.id, c.req.param('id'));
      return c.json(ok(session));
   })
   .get('/recommendation', async (c) => {
      const query = parse(recommendationQuerySchema, c.req.query());
      const recommendation = await recommendStudyPlan(c.env, c.get('user')!.id, query);
      return c.json(ok(recommendation));
   });
