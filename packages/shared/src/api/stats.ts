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

/** Account-level summary used by the dashboard overview. */
export const overviewStatsSchema = z.object({
   streak: z.number().int().nonnegative(),
   /** Past review counts per day across all decks (sparse). */
   activity: z.array(dueForecastPointSchema),
});

export type OverviewStats = z.infer<typeof overviewStatsSchema>;

export const accuracyTrendPointSchema = z.object({
   date: z.string(),
   total: z.number().int().nonnegative(),
   correct: z.number().int().nonnegative(),
   accuracy: z.number().min(0).max(1),
});

export type AccuracyTrendPoint = z.infer<typeof accuracyTrendPointSchema>;

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
   /** Past review counts per day (sparse — days with no reviews are omitted). */
   activity: z.array(dueForecastPointSchema),
   /** Past accuracy per day (sparse — days with no reviews are omitted). */
   accuracyTrend: z.array(accuracyTrendPointSchema),
   weakCards: z.array(weakCardSchema),
});

export type DeckStats = z.infer<typeof deckStatsSchema>;
