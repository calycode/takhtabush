import { z } from 'zod';
import { MAX_IMPORT_BYTES, MAX_TAG_LENGTH, MAX_TAGS_PER_CARD } from '../domain/limits';
import { idSchema, isoDateSchema } from './common';
import { DELIMITER_CHOICES, TAG_SEPARATORS } from './import';

export const cardTypeSchema = z.enum([
   'term_definition',
   'cloze',
   'multiple_choice',
   'typed',
   'image_prompt',
]);

export type CardType = z.infer<typeof cardTypeSchema>;

export const cardStatusSchema = z.enum(['active', 'draft', 'suspended']);
export type CardStatus = z.infer<typeof cardStatusSchema>;

export const cardSourceSchema = z.enum(['manual', 'import', 'ai']);
export type CardSource = z.infer<typeof cardSourceSchema>;

export const tagSchema = z.string().min(1).max(MAX_TAG_LENGTH);

export const cardSchema = z.object({
   id: idSchema,
   deckId: idSchema,
   ownerId: idSchema,
   type: cardTypeSchema,
   front: z.string(),
   back: z.string().nullable(),
   clozeText: z.string().nullable(),
   choices: z.array(z.string()).nullable(),
   correctChoice: z.number().int().nullable(),
   imageMediaId: idSchema.nullable(),
   audioMediaId: idSchema.nullable(),
   tags: z.array(tagSchema),
   status: cardStatusSchema,
   source: cardSourceSchema,
   createdAt: isoDateSchema,
   updatedAt: isoDateSchema,
   deletedAt: isoDateSchema.nullable(),
});

export type Card = z.infer<typeof cardSchema>;

/** Create input (SPEC §6.3). Type-specific requirements are enforced in `refine`. */
export const createCardInputSchema = z
   .object({
      type: cardTypeSchema,
      front: z.string().min(1).max(2000),
      back: z.string().max(5000).optional(),
      clozeText: z.string().max(5000).optional(),
      choices: z.array(z.string().max(500)).max(8).optional(),
      correctChoice: z.number().int().min(0).max(7).optional(),
      tags: z.array(tagSchema).max(MAX_TAGS_PER_CARD).default([]),
      imageMediaId: idSchema.optional(),
      audioMediaId: idSchema.optional(),
      status: cardStatusSchema.default('active'),
      source: cardSourceSchema.default('manual'),
   })
   .superRefine((card, ctx) => {
      const require = (field: keyof typeof card, message: string) => {
         if (card[field] === undefined || card[field] === null || card[field] === '') {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: [field] });
         }
      };

      if (card.type === 'term_definition' || card.type === 'typed')
         require('back', 'back is required');
      if (card.type === 'cloze') require('clozeText', 'clozeText is required');
      if (card.type === 'image_prompt') require('imageMediaId', 'imageMediaId is required');
      if (card.type === 'multiple_choice') {
         if (!card.choices || card.choices.length < 2) {
            ctx.addIssue({
               code: z.ZodIssueCode.custom,
               message: 'choices must contain at least 2 options',
               path: ['choices'],
            });
         }
         if (card.correctChoice === undefined) {
            ctx.addIssue({
               code: z.ZodIssueCode.custom,
               message: 'correctChoice is required',
               path: ['correctChoice'],
            });
         } else if (card.choices && card.correctChoice >= card.choices.length) {
            ctx.addIssue({
               code: z.ZodIssueCode.custom,
               message: 'correctChoice is out of range',
               path: ['correctChoice'],
            });
         }
      }
   });

export type CreateCardInput = z.infer<typeof createCardInputSchema>;

/** Request shape accepted by clients before defaults are applied. */
export type CreateCardRequest = z.input<typeof createCardInputSchema>;

export const updateCardInputSchema = z.object({
   front: z.string().min(1).max(2000).optional(),
   back: z.string().max(5000).nullable().optional(),
   clozeText: z.string().max(5000).nullable().optional(),
   choices: z.array(z.string().max(500)).max(8).nullable().optional(),
   correctChoice: z.number().int().min(0).max(7).nullable().optional(),
   tags: z.array(tagSchema).max(MAX_TAGS_PER_CARD).optional(),
   imageMediaId: idSchema.nullable().optional(),
   audioMediaId: idSchema.nullable().optional(),
   status: cardStatusSchema.optional(),
});

export type UpdateCardInput = z.infer<typeof updateCardInputSchema>;

/** Request shape accepted by clients for partial updates. */
export type UpdateCardRequest = z.input<typeof updateCardInputSchema>;

export const cardRevisionSchema = z.object({
   id: idSchema,
   cardId: idSchema,
   authorId: idSchema,
   snapshot: z.record(z.unknown()),
   createdAt: isoDateSchema,
});

export type CardRevision = z.infer<typeof cardRevisionSchema>;

/** Import formats supported by `POST /decks/:id/import` (SPEC §6.2). */
export const importFormatSchema = z.enum(['csv', 'tsv', 'json']);
export type ImportFormat = z.infer<typeof importFormatSchema>;

export const importDeckInputSchema = z.object({
   format: importFormatSchema,
   content: z.string().min(1).max(MAX_IMPORT_BYTES),
   hasHeader: z.boolean().default(false),
   tags: z.array(tagSchema).max(MAX_TAGS_PER_CARD).default([]),
   /** [R5] Column delimiter for CSV; `auto` infers it from the content. */
   delimiter: z.enum(DELIMITER_CHOICES).optional(),
   /** [R5] How the tags column is split; `none` keeps the whole field as one tag. */
   tagSeparator: z.enum(TAG_SEPARATORS).optional(),
});

export type ImportDeckInput = z.infer<typeof importDeckInputSchema>;

/** Request shape accepted by clients before defaults are applied. */
export type ImportDeckRequest = z.input<typeof importDeckInputSchema>;

export const importResultSchema = z.object({
   imported: z.number().int().nonnegative(),
   updated: z.number().int().nonnegative(),
   skipped: z.number().int().nonnegative(),
   errors: z.array(z.object({ row: z.number().int(), message: z.string() })),
});

export type ImportResult = z.infer<typeof importResultSchema>;

export const exportFormatSchema = z.enum(['csv', 'tsv', 'json']);
export type ExportFormat = z.infer<typeof exportFormatSchema>;
