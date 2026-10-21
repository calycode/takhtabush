import { z } from 'zod';

/** A tag and how many of the user's cards use it. */
export const tagSummarySchema = z.object({
   name: z.string(),
   count: z.number().int().nonnegative(),
});

export type TagSummary = z.infer<typeof tagSummarySchema>;
