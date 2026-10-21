import { z } from 'zod';

export const studyModeSchema = z.enum([
   'flashcards',
   'multiple_choice',
   'typed',
   'matching',
   'cloze',
   'mixed',
]);
export type StudyMode = z.infer<typeof studyModeSchema>;

export const reviewResponseSchema = z.enum(['again', 'hard', 'good', 'easy']);
export type ReviewResponse = z.infer<typeof reviewResponseSchema>;

/**
 * Two layouts for the `matching` mode. `pairs` is a two-column association
 * exercise (recall by association); `choice` is an option pick (recognition).
 */
export const matchingVariantSchema = z.enum(['pairs', 'choice']);
export type MatchingVariant = z.infer<typeof matchingVariantSchema>;

export const studyGoalSchema = z.enum(['learn', 'review', 'cram', 'retain', 'diagnose']);
export type StudyGoal = z.infer<typeof studyGoalSchema>;

export const journeyStrategySchema = z.enum([
   'review_weak',
   'consolidate',
   'new_material',
   'mixed',
]);
export type JourneyStrategy = z.infer<typeof journeyStrategySchema>;

export const sessionStatusSchema = z.enum(['active', 'completed', 'abandoned']);
export type SessionStatus = z.infer<typeof sessionStatusSchema>;

export const createdBySchema = z.enum(['user', 'mcp']);
export type CreatedBy = z.infer<typeof createdBySchema>;

/** Default daily limits (SPEC §7.2). */
export const DEFAULT_NEW_PER_DAY = 20;
export const DEFAULT_REVIEWS_PER_DAY = 200;

/** `again` counts as incorrect; every other response is correct. */
export function isCorrectResponse(response: ReviewResponse): boolean {
   return response !== 'again';
}

/** Rough per-card cost used to translate a time budget into a card count. */
const MINUTES_PER_CARD: Record<StudyMode, number> = {
   flashcards: 0.5,
   multiple_choice: 0.4,
   typed: 0.75,
   matching: 0.35,
   cloze: 0.5,
   mixed: 0.6,
};

export function estimateMinutes(cardCount: number, mode: StudyMode): number {
   return Math.max(1, Math.ceil(cardCount * MINUTES_PER_CARD[mode]));
}

export function maxCardsForMinutes(minutes: number, mode: StudyMode): number {
   return Math.max(1, Math.floor(minutes / MINUTES_PER_CARD[mode]));
}
