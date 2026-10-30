import type { Collection, CreateCollectionInput, UpdateCollectionInput } from '@caly/shared';
import { LIMIT_ERROR_CODES, MAX_COLLECTIONS_PER_USER } from '@caly/shared';
import type { AppEnv } from '../env';
import { forbidden, limitExceeded, notFound } from '../lib/errors';
import {
   countCollections,
   getCollectionRow,
   insertCollection,
   listCollections,
   mapCollection,
   softDeleteCollection,
   updateCollection,
} from '../repositories/collections';
import { detachDecksFromCollection } from '../repositories/decks';

export function listUserCollections(env: AppEnv, userId: string): Promise<Collection[]> {
   return listCollections(env, userId);
}

/** Load a collection and prove the caller owns it; 404 before 403 for strangers. */
export async function getOwnedCollection(
   env: AppEnv,
   userId: string,
   collectionId: string,
): Promise<Collection> {
   const row = await getCollectionRow(env, collectionId);
   if (!row) throw notFound('Collection not found');
   if (String(row.owner_id) !== userId) throw forbidden('You do not own this collection');
   return mapCollection(row);
}

export async function createCollection(
   env: AppEnv,
   userId: string,
   input: CreateCollectionInput,
): Promise<Collection> {
   const existing = await countCollections(env, userId);
   if (existing >= MAX_COLLECTIONS_PER_USER) {
      throw limitExceeded(
         LIMIT_ERROR_CODES.collectionsPerUser,
         `You can have at most ${MAX_COLLECTIONS_PER_USER} collections.`,
         { limit: MAX_COLLECTIONS_PER_USER, current: existing },
      );
   }
   return insertCollection(env, { ownerId: userId, name: input.name, position: input.position });
}

export async function patchCollection(
   env: AppEnv,
   userId: string,
   collectionId: string,
   input: UpdateCollectionInput,
): Promise<Collection> {
   await getOwnedCollection(env, userId, collectionId);
   const collection = await updateCollection(env, collectionId, input);
   if (!collection) throw notFound('Collection not found');
   return collection;
}

/** Soft-delete a collection and unfile its decks; decks are never deleted. */
export async function removeCollection(
   env: AppEnv,
   userId: string,
   collectionId: string,
): Promise<void> {
   await getOwnedCollection(env, userId, collectionId);
   await detachDecksFromCollection(env, userId, collectionId);
   await softDeleteCollection(env, collectionId);
}
