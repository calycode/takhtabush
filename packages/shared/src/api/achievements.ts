import { z } from 'zod';
import { isoDateSchema } from './common';

export const achievementCategorySchema = z.enum([
   'starter',
   'consistency',
   'volume',
   'accuracy',
   'mastery',
   'explorer',
   'arcade',
   'social',
]);

export const achievementTierSchema = z.enum(['bronze', 'silver', 'gold', 'platinum']);

export const achievementSchema = z.object({
   id: z.string(),
   title: z.string(),
   description: z.string(),
   category: achievementCategorySchema,
   tier: achievementTierSchema,
   icon: z.string(),
   shareText: z.string(),
   unlockedAt: isoDateSchema.nullable(),
   seenAt: isoDateSchema.nullable(),
   sharedAt: isoDateSchema.nullable(),
});

export type Achievement = z.infer<typeof achievementSchema>;

export const achievementsResponseSchema = z.object({
   items: z.array(achievementSchema),
   pending: z.array(achievementSchema),
});

export type AchievementsResponse = z.infer<typeof achievementsResponseSchema>;

export const achievementEvaluateResponseSchema = z.object({
   newAchievements: z.array(achievementSchema),
});

export type AchievementEvaluateResponse = z.infer<typeof achievementEvaluateResponseSchema>;

export const achievementSeenInputSchema = z.object({
   ids: z.array(z.string()).max(100),
});

export type AchievementSeenInput = z.infer<typeof achievementSeenInputSchema>;
