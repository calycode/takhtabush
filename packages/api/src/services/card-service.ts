import type { Card, CreateCardInput, UpdateCardInput } from '@caly/shared';
import { LIMIT_ERROR_CODES, MAX_CARDS_PER_BULK_CREATE, MAX_CARDS_PER_DECK } from '@caly/shared';
import { newId } from '@caly/worker-kit';
import type { AppEnv } from '../env';
import { forbidden, limitExceeded, notFound } from '../lib/errors';
import { mapCard } from '../lib/map';
import {
   getCardRow,
   getCardRowIncludingDeleted,
   insertCard,
   insertCardRevision,
   insertCardRows,
   listCards,
   restoreCard as restoreCardRow,
   softDeleteCard,
   updateCard,
} from '../repositories/cards';
import { releaseCardSlots, reserveCardSlots } from '../repositories/decks';
import { parseTagsJson } from '../repositories/card-tags';
import { getOwnedDeck } from './deck-service';

function cardLimitExceeded(deckId: string, current: number, requested: number) {
   return limitExceeded(
      LIMIT_ERROR_CODES.cardsPerDeck,
      `A deck can hold at most ${MAX_CARDS_PER_DECK} cards.`,
      { limit: MAX_CARDS_PER_DECK, current, requested, deckId },
   );
}

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

/**
 * Create one card. The deck's `card_count` slot is reserved with one
 * conditional UPDATE (the authoritative cap check) instead of recounting the
 * deck after the write.
 */
export async function createCard(
   env: AppEnv,
   userId: string,
   deckId: string,
   input: CreateCardInput,
): Promise<Card> {
   const deck = await getOwnedDeck(env, userId, deckId);
   const reserved = await reserveCardSlots(env, deckId, 1, MAX_CARDS_PER_DECK);
   if (!reserved) throw cardLimitExceeded(deckId, deck.cardCount, 1);
   try {
      return await insertCard(env, { deckId, ownerId: userId, card: input });
   } catch (cause) {
      await releaseCardSlots(env, deckId, 1);
      throw cause;
   }
}

/** Bulk-create cards (MCP `create_cards`) with one reservation and batched inserts. */
export async function createCards(
   env: AppEnv,
   userId: string,
   deckId: string,
   cards: CreateCardInput[],
): Promise<Card[]> {
   if (cards.length === 0) return [];
   if (cards.length > MAX_CARDS_PER_BULK_CREATE) {
      throw limitExceeded(
         LIMIT_ERROR_CODES.cardsPerBulkCreate,
         `A bulk create accepts at most ${MAX_CARDS_PER_BULK_CREATE} cards.`,
         { limit: MAX_CARDS_PER_BULK_CREATE, requested: cards.length },
      );
   }
   const deck = await getOwnedDeck(env, userId, deckId);
   const reserved = await reserveCardSlots(env, deckId, cards.length, MAX_CARDS_PER_DECK);
   if (!reserved) throw cardLimitExceeded(deckId, deck.cardCount, cards.length);
   try {
      return await insertCardRows(
         env,
         cards.map((card) => ({ id: newId('card'), deckId, ownerId: userId, card })),
      );
   } catch (cause) {
      await releaseCardSlots(env, deckId, cards.length);
      throw cause;
   }
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
   const card = await updateCard(env, cardId, input, {
      ownerId: existing.ownerId,
      deckId: existing.deckId,
   });
   if (!card) throw notFound('Card not found');
   return card;
}

export async function removeCard(env: AppEnv, userId: string, cardId: string): Promise<void> {
   const card = await getOwnedCard(env, userId, cardId);
   await softDeleteCard(env, cardId);
   await releaseCardSlots(env, card.deckId, 1);
}

/** Undo a soft-delete. Restoring has to fit under the cap just like a create. */
export async function restoreCard(env: AppEnv, userId: string, cardId: string): Promise<Card> {
   const row = await getCardRowIncludingDeleted(env, cardId);
   if (!row) throw notFound('Card not found');
   if (String(row.owner_id) !== userId) throw forbidden('You do not own this card');
   if (!row.deleted_at) return mapCard(row);

   const deckId = String(row.deck_id);
   const deck = await getOwnedDeck(env, userId, deckId);
   const reserved = await reserveCardSlots(env, deckId, 1, MAX_CARDS_PER_DECK);
   if (!reserved) throw cardLimitExceeded(deckId, deck.cardCount, 1);
   try {
      await restoreCardRow(env, {
         cardId,
         ownerId: userId,
         deckId,
         tags: parseTagsJson(row.tags_json),
      });
   } catch (cause) {
      await releaseCardSlots(env, deckId, 1);
      throw cause;
   }
   const restored = await getCardRow(env, cardId);
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
