import type { Card, CreateCardInput, UpdateCardInput } from '@caly/shared';
import type { AppEnv } from '../env';
import { forbidden, notFound } from '../lib/errors';
import { mapCard } from '../lib/map';
import {
   getCardRow,
   getCardRowIncludingDeleted,
   insertCard,
   insertCardRevision,
   listCards,
   restoreCard as restoreCardRow,
   softDeleteCard,
   updateCard,
} from '../repositories/cards';
import { recalcCardCount } from '../repositories/decks';
import { getOwnedDeck } from './deck-service';

export async function listDeckCards(
   env: AppEnv,
   userId: string,
   deckId: string,
   opts: { limit: number; cursor?: string; status?: string },
) {
   await getOwnedDeck(env, userId, deckId);
   return listCards(env, deckId, opts);
}

export async function getOwnedCard(env: AppEnv, userId: string, cardId: string): Promise<Card> {
   const row = await getCardRow(env, cardId);
   if (!row) throw notFound('Card not found');
   if (String(row.owner_id) !== userId) throw forbidden('You do not own this card');
   return mapCard(row);
}

export async function createCard(
   env: AppEnv,
   userId: string,
   deckId: string,
   input: CreateCardInput,
): Promise<Card> {
   await getOwnedDeck(env, userId, deckId);
   const card = await insertCard(env, { deckId, ownerId: userId, card: input });
   await recalcCardCount(env, deckId);
   return card;
}

export async function patchCard(
   env: AppEnv,
   userId: string,
   cardId: string,
   input: UpdateCardInput,
): Promise<Card> {
   const existing = await getOwnedCard(env, userId, cardId);
   await insertCardRevision(env, {
      cardId,
      authorId: userId,
      snapshot: existing as unknown as Record<string, unknown>,
   });
   const card = await updateCard(env, cardId, input);
   if (!card) throw notFound('Card not found');
   return card;
}

export async function removeCard(env: AppEnv, userId: string, cardId: string): Promise<void> {
   const card = await getOwnedCard(env, userId, cardId);
   await softDeleteCard(env, cardId);
   await recalcCardCount(env, card.deckId);
}

/** Undo a soft-delete. The card is only truly purged by the cleanup job. */
export async function restoreCard(env: AppEnv, userId: string, cardId: string): Promise<Card> {
   const row = await getCardRowIncludingDeleted(env, cardId);
   if (!row) throw notFound('Card not found');
   if (String(row.owner_id) !== userId) throw forbidden('You do not own this card');
   if (row.deleted_at) {
      await restoreCardRow(env, cardId);
      await recalcCardCount(env, String(row.deck_id));
   }
   const restored = await getCardRowIncludingDeleted(env, cardId);
   if (!restored) throw notFound('Card not found');
   return mapCard(restored);
}

/**
 * Suspend or resume a card. Suspended cards are excluded from automatic
 * sessions and from due/new/weak queues (SPEC §7.2).
 */
export async function setCardSuspended(
   env: AppEnv,
   userId: string,
   cardId: string,
   suspended: boolean,
): Promise<Card> {
   await getOwnedCard(env, userId, cardId);
   const card = await updateCard(env, cardId, { status: suspended ? 'suspended' : 'active' });
   if (!card) throw notFound('Card not found');
   return card;
}
