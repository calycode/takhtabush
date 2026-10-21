import { z } from 'zod';
import { idSchema } from './common';

export const dueForecastPointSchema = z.object({
   date: z.string(),
   count: z.number().int().nonnegative(),
});

export type DueForecastPoint = z.infer<typeof dueForecastPointSchema>;

export const weakCardSchema = z.object({
   cardId: idSchema,
   front: z.string().max(120),
   accuracy: z.number().min(0).max(1),
   lapses: z.number().int().nonnegative(),
});

export type WeakCard = z.infer<typeof weakCardSchema>;

export const deckStatsSchema = z.object({
   deckId: idSchema,
   totalCards: z.number().int().nonnegative(),
   newCards: z.number().int().nonnegative(),
   dueCards: z.number().int().nonnegative(),
   learningCards: z.number().int().nonnegative(),
   suspendedCards: z.number().int().nonnegative(),
   totalReviews: z.number().int().nonnegative(),
   accuracy: z.number().min(0).max(1).nullable(),
   streak: z.number().int().nonnegative(),
   dueForecast: z.array(dueForecastPointSchema),
   weakCards: z.array(weakCardSchema),
});

export type DeckStats = z.infer<typeof deckStatsSchema>;
