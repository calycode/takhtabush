import type { CreateDeckInput, Deck, UpdateDeckInput } from '@caly/shared';
import { LIMIT_ERROR_CODES, MAX_DECKS_PER_COLLECTION, type ListDecksQuery } from '@caly/shared';
import type { AppEnv } from '../env';
import { forbidden, limitExceeded, notFound } from '../lib/errors';
import { mapDeck } from '../lib/map';
import {
   countDecksInCollection,
   getDeckRow,
   insertDeck,
   listDecks,
   softDeleteDeck,
   updateDeck,
} from '../repositories/decks';
import { getOwnedCollection } from './collection-service';

export async function listDecksForUser(
   env: AppEnv,
   userId: string,
   opts: Pick<ListDecksQuery, 'limit' | 'cursor'> & {
      collectionId?: string;
      unfiled?: boolean;
   },
) {
   return listDecks(env, userId, {
      limit: opts.limit,
      cursor: opts.cursor,
      collectionId: opts.collectionId,
      unfiled: opts.unfiled,
   });
}

export async function getOwnedDeck(env: AppEnv, userId: string, deckId: string): Promise<Deck> {
   const row = await getDeckRow(env, deckId);
   if (!row) throw notFound('Deck not found');
   if (String(row.owner_id) !== userId) throw forbidden('You do not own this deck');
   return mapDeck(row);
}

/**
 * Collections are owner-scoped and capped per collection. Both checks run
 * before the write, and the count is one indexed aggregate (never per-deck).
 */
async function assertCollectionCapacity(
   env: AppEnv,
   userId: string,
   collectionId: string,
   movingDeckId?: string,
): Promise<void> {
   const collection = await getOwnedCollection(env, userId, collectionId);
   if (movingDeckId) {
      const row = await getDeckRow(env, movingDeckId);
      if (row && row.collection_id === collectionId) return;
   }
   const decks = await countDecksInCollection(env, userId, collectionId);
   if (decks >= MAX_DECKS_PER_COLLECTION) {
      throw limitExceeded(
         LIMIT_ERROR_CODES.decksPerCollection,
         `A collection can hold at most ${MAX_DECKS_PER_COLLECTION} decks.`,
         { limit: MAX_DECKS_PER_COLLECTION, current: decks, collectionId: collection.id },
      );
   }
}

export async function createDeck(
   env: AppEnv,
   userId: string,
   input: CreateDeckInput,
): Promise<Deck> {
   if (input.collectionId) {
      await assertCollectionCapacity(env, userId, input.collectionId);
   }
   return insertDeck(env, {
      ownerId: userId,
      title: input.title,
      description: input.description,
      collectionId: input.collectionId,
   });
}

export async function patchDeck(
   env: AppEnv,
   userId: string,
   deckId: string,
   input: UpdateDeckInput,
): Promise<Deck> {
   const existing = await getOwnedDeck(env, userId, deckId);
   if (input.collectionId && input.collectionId !== existing.collectionId) {
      await assertCollectionCapacity(env, userId, input.collectionId, deckId);
   }
   const deck = await updateDeck(env, deckId, input);
   if (!deck) throw notFound('Deck not found');
   return deck;
}

export async function removeDeck(env: AppEnv, userId: string, deckId: string): Promise<void> {
   await getOwnedDeck(env, userId, deckId);
   await softDeleteDeck(env, deckId);
}
