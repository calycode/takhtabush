import type { CreateDeckInput, Deck, UpdateDeckInput } from '@caly/shared';
import type { AppEnv } from '../env';
import { forbidden, notFound } from '../lib/errors';
import { mapDeck } from '../lib/map';
import {
   getDeckRow,
   insertDeck,
   listDecks,
   softDeleteDeck,
   updateDeck,
} from '../repositories/decks';

export async function listDecksForUser(
   env: AppEnv,
   userId: string,
   opts: { limit: number; cursor?: string },
) {
   return listDecks(env, userId, opts);
}

export async function getOwnedDeck(env: AppEnv, userId: string, deckId: string): Promise<Deck> {
   const row = await getDeckRow(env, deckId);
   if (!row) throw notFound('Deck not found');
   if (String(row.owner_id) !== userId) throw forbidden('You do not own this deck');
   return mapDeck(row);
}

export async function createDeck(
   env: AppEnv,
   userId: string,
   input: CreateDeckInput,
): Promise<Deck> {
   return insertDeck(env, {
      ownerId: userId,
      title: input.title,
      description: input.description,
      folderId: input.folderId,
   });
}

export async function patchDeck(
   env: AppEnv,
   userId: string,
   deckId: string,
   input: UpdateDeckInput,
): Promise<Deck> {
   await getOwnedDeck(env, userId, deckId);
   const deck = await updateDeck(env, deckId, input);
   if (!deck) throw notFound('Deck not found');
   return deck;
}

export async function removeDeck(env: AppEnv, userId: string, deckId: string): Promise<void> {
   await getOwnedDeck(env, userId, deckId);
   await softDeleteDeck(env, deckId);
}
