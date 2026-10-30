import { Hono } from 'hono';
import type { AppBindings } from '../env';
import { csrfProtection, requireAuth } from '../middleware/auth';
import { aiRoutes } from './ai';
import { apiKeyRoutes } from './api-keys';
import { authRoutes } from './auth';
import { cardRoutes } from './cards';
import { collectionRoutes } from './collections';
import { deckRoutes } from './decks';
import { healthRoutes } from './health';
import { mediaRoutes } from './media';
import { meRoutes } from './me';
import { oauthRoutes } from './oauth';
import { sessionRoutes } from './sessions';
import { statsRoutes } from './stats';
import { tagRoutes } from './tags';
import { studyRoutes } from './study';

/** Mount all versioned API routes onto the application. */
export function registerRoutes(app: Hono<AppBindings>): Hono<AppBindings> {
   app.route('/oauth', oauthRoutes);
   app.route('/api/v1/health', healthRoutes);
   app.route('/api/v1/auth', authRoutes);

   const protectedApi = new Hono<AppBindings>();
   protectedApi.use('*', requireAuth);
   protectedApi.use('*', csrfProtection);
   protectedApi.route('/me', meRoutes);
   protectedApi.route('/sessions', sessionRoutes);
   protectedApi.route('/decks', deckRoutes);
   protectedApi.route('/cards', cardRoutes);
   protectedApi.route('/collections', collectionRoutes);
   protectedApi.route('/tags', tagRoutes);
   protectedApi.route('/media', mediaRoutes);
   protectedApi.route('/study', studyRoutes);
   protectedApi.route('/stats', statsRoutes);
   protectedApi.route('/ai', aiRoutes);
   protectedApi.route('/api-keys', apiKeyRoutes);

   app.route('/api/v1', protectedApi);
   return app;
}
