import { Hono } from 'hono';
import {
   createCardInputSchema,
   createDeckInputSchema,
   cursorQuerySchema,
   exportFormatSchema,
   importDeckInputSchema,
   updateDeckInputSchema,
} from '@caly/shared';
import { ok } from '@caly/worker-kit';
import type { AppBindings } from '../env';
import { parse } from '../lib/validation';
import { listAllCards } from '../repositories/cards';
import { createCard, listDeckCards } from '../services/card-service';
import {
   createDeck,
   getOwnedDeck,
   listDecksForUser,
   patchDeck,
   removeDeck,
} from '../services/deck-service';
import { importIntoDeck } from '../services/import-service';
import { getStudyOptions } from '../services/study-service';

function pageMeta(nextCursor: string | null) {
   return { nextCursor, hasMore: nextCursor !== null };
}

export const deckRoutes = new Hono<AppBindings>()
   .get('/', async (c) => {
      const query = parse(cursorQuerySchema, c.req.query());
      const { items, nextCursor } = await listDecksForUser(c.env, c.get('user')!.id, query);
      return c.json({ data: items, meta: pageMeta(nextCursor) });
   })
   .post('/', async (c) => {
      const input = parse(createDeckInputSchema, await c.req.json());
      const deck = await createDeck(c.env, c.get('user')!.id, input);
      return c.json(ok(deck), 201);
   })
   .get('/:id', async (c) => {
      const deck = await getOwnedDeck(c.env, c.get('user')!.id, c.req.param('id'));
      return c.json(ok(deck));
   })
   .patch('/:id', async (c) => {
      const input = parse(updateDeckInputSchema, await c.req.json());
      const deck = await patchDeck(c.env, c.get('user')!.id, c.req.param('id'), input);
      return c.json(ok(deck));
   })
   .delete('/:id', async (c) => {
      await removeDeck(c.env, c.get('user')!.id, c.req.param('id'));
      return c.body(null, 204);
   })
   .get('/:id/cards', async (c) => {
      const query = parse(cursorQuerySchema, c.req.query());
      const { items, nextCursor } = await listDeckCards(
         c.env,
         c.get('user')!.id,
         c.req.param('id'),
         query,
      );
      return c.json({ data: items, meta: pageMeta(nextCursor) });
   })
   .post('/:id/cards', async (c) => {
      const input = parse(createCardInputSchema, await c.req.json());
      const card = await createCard(c.env, c.get('user')!.id, c.req.param('id'), input);
      return c.json(ok(card), 201);
   })
   .post('/:id/import', async (c) => {
      const input = parse(importDeckInputSchema, await c.req.json());
      const result = await importIntoDeck(c.env, c.get('user')!.id, c.req.param('id'), input);
      return c.json(ok(result));
   })
   .get('/:id/study-options', async (c) => {
      const options = await getStudyOptions(c.env, c.get('user')!.id, c.req.param('id'));
      return c.json(ok(options));
   })
   .get('/:id/export', async (c) => {
      const deck = await getOwnedDeck(c.env, c.get('user')!.id, c.req.param('id'));
      const format = parse(exportFormatSchema, c.req.query('format') ?? 'csv');
      const cards = await listAllCards(c.env, deck.id);

      if (format === 'json') {
         const body = JSON.stringify(
            cards.map((card) => ({
               front: card.front,
               back: card.back,
               type: card.type,
               tags: card.tags,
            })),
            null,
            2,
         );
         return new Response(body, {
            headers: {
               'content-type': 'application/json',
               'content-disposition': `attachment; filename="${deck.id}.json"`,
            },
         });
      }

      const delimiter = format === 'tsv' ? '\t' : ',';
      const escape = (value: string | null) => {
         const text = value ?? '';
         return /["\n\r,;\t]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
      };
      const lines = [
         ['front', 'back', 'tags'].join(delimiter),
         ...cards.map((card) =>
            [escape(card.front), escape(card.back), escape(card.tags.join(';'))].join(delimiter),
         ),
      ];
      return new Response(lines.join('\n'), {
         headers: {
            'content-type': format === 'tsv' ? 'text/tab-separated-values' : 'text/csv',
            'content-disposition': `attachment; filename="${deck.id}.${format}"`,
         },
      });
   });
