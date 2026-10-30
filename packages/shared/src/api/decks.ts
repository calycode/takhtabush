import { z } from 'zod';
import { cursorQuerySchema, idSchema, isoDateSchema } from './common';

export const deckSchema = z.object({
   id: idSchema,
   ownerId: idSchema,
   title: z.string(),
   description: z.string().nullable(),
   collectionId: idSchema.nullable(),
   cardCount: z.number().int().nonnegative(),
   createdAt: isoDateSchema,
   updatedAt: isoDateSchema,
   deletedAt: isoDateSchema.nullable(),
});

export type Deck = z.infer<typeof deckSchema>;

export const createDeckInputSchema = z.object({
   title: z.string().min(1).max(200),
   description: z.string().max(2000).optional(),
   collectionId: idSchema.optional(),
});

export type CreateDeckInput = z.infer<typeof createDeckInputSchema>;

export const updateDeckInputSchema = z.object({
   title: z.string().min(1).max(200).optional(),
   description: z.string().max(2000).nullable().optional(),
   collectionId: idSchema.nullable().optional(),
});

export type UpdateDeckInput = z.infer<typeof updateDeckInputSchema>;

/** Deck list filters. `unfiled=true` selects decks that are in no collection. */
export const listDecksQuerySchema = cursorQuerySchema.extend({
   collectionId: idSchema.optional(),
   unfiled: z.enum(['true', 'false']).optional(),
});

export type ListDecksQuery = z.infer<typeof listDecksQuerySchema>;

/** Compact deck projection used by MCP and list views (SPEC §9.5). */
export const deckSummarySchema = z.object({
   id: idSchema,
   title: z.string(),
   description: z.string().max(160).nullable(),
   collectionId: idSchema.nullable(),
   cardCount: z.number().int().nonnegative(),
   dueCount: z.number().int().nonnegative(),
   updatedAt: isoDateSchema,
});

export type DeckSummary = z.infer<typeof deckSummarySchema>;
