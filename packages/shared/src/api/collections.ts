import { z } from 'zod';
import { MAX_COLLECTION_NAME_LENGTH } from '../domain/limits';
import { idSchema, isoDateSchema } from './common';

/**
 * A flat, owner-scoped grouping of decks (SPEC §4.4). One level only: no
 * parent ids, so listing collections never needs a recursive walk.
 */
export const collectionSchema = z.object({
   id: idSchema,
   ownerId: idSchema,
   name: z.string(),
   position: z.number().int().nonnegative(),
   deckCount: z.number().int().nonnegative(),
   createdAt: isoDateSchema,
   updatedAt: isoDateSchema,
   deletedAt: isoDateSchema.nullable(),
});

export type Collection = z.infer<typeof collectionSchema>;

const collectionName = z.string().trim().min(1).max(MAX_COLLECTION_NAME_LENGTH);

export const createCollectionInputSchema = z.object({
   name: collectionName,
   position: z.number().int().min(0).max(10_000).optional(),
});

export type CreateCollectionInput = z.infer<typeof createCollectionInputSchema>;

export const updateCollectionInputSchema = z.object({
   name: collectionName.optional(),
   position: z.number().int().min(0).max(10_000).optional(),
});

export type UpdateCollectionInput = z.infer<typeof updateCollectionInputSchema>;
