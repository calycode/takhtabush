import { z } from 'zod';
import { idSchema, isoDateSchema } from './common';
import { MAX_CARDS_PER_DECK } from '../domain/limits';
import { learningStateSchema } from '../domain/scheduler';
import { studyPlanSchema } from '../domain/journey';
import {
   createdBySchema,
   journeyStrategySchema,
   reviewResponseSchema,
   sessionStatusSchema,
   studyGoalSchema,
   studyModeSchema,
} from '../domain/modes';

export const studyTypeCountsSchema = z.object({
   term_definition: z.number().int().nonnegative(),
   cloze: z.number().int().nonnegative(),
   multiple_choice: z.number().int().nonnegative(),
   typed: z.number().int().nonnegative(),
   image_prompt: z.number().int().nonnegative(),
});

export type StudyTypeCounts = z.infer<typeof studyTypeCountsSchema>;

/** What a deck can currently support, used to drive the study launcher. */
export const studyOptionsSchema = z.object({
   cardCount: z.number().int().nonnegative(),
   dueCount: z.number().int().nonnegative(),
   newCount: z.number().int().nonnegative(),
   typeCounts: studyTypeCountsSchema,
   availableModes: z.array(studyModeSchema),
});

export type StudyOptions = z.infer<typeof studyOptionsSchema>;

export const studyPreviewInputSchema = z.object({
   deckId: idSchema,
   mode: studyModeSchema,
   goal: studyGoalSchema,
   minutes: z.number().int().min(1).max(180),
});

export type StudyPreviewInput = z.infer<typeof studyPreviewInputSchema>;

/** A dry-run of the deterministic plan (no session is created). */
export const studyPreviewSchema = z.object({
   cardCount: z.number().int().nonnegative(),
   estimatedMinutes: z.number().int().nonnegative(),
   strategy: journeyStrategySchema,
   reasons: z.record(z.number()),
});

export type StudyPreview = z.infer<typeof studyPreviewSchema>;

export const startSessionInputSchema = z.object({
   deckId: idSchema,
   mode: studyModeSchema.default('flashcards'),
   goal: studyGoalSchema.default('learn'),
   minutes: z.number().int().min(1).max(180).default(15),
   cardIds: z.array(idSchema).max(MAX_CARDS_PER_DECK).optional(),
});

export type StartSessionInput = z.infer<typeof startSessionInputSchema>;

/** Request shape accepted by clients before defaults are applied. */
export type StartSessionRequest = z.input<typeof startSessionInputSchema>;

export const studySessionSchema = z.object({
   id: idSchema,
   userId: idSchema,
   deckId: idSchema,
   mode: studyModeSchema,
   strategy: z.string().nullable(),
   plannedCardIds: z.array(idSchema),
   status: sessionStatusSchema,
   startedAt: isoDateSchema,
   completedAt: isoDateSchema.nullable(),
   createdBy: createdBySchema,
});

export type StudySession = z.infer<typeof studySessionSchema>;

export const reviewEventInputSchema = z.object({
   cardId: idSchema,
   response: reviewResponseSchema,
   durationMs: z.number().int().nonnegative().max(3_600_000).optional(),
});

export type ReviewEventInput = z.infer<typeof reviewEventInputSchema>;

export const reviewEventSchema = z.object({
   id: idSchema,
   sessionId: idSchema,
   cardId: idSchema,
   userId: idSchema,
   response: reviewResponseSchema,
   isCorrect: z.boolean(),
   durationMs: z.number().int().nonnegative().nullable(),
   schedulerState: z.record(z.unknown()),
   reviewedAt: isoDateSchema,
});

export type ReviewEvent = z.infer<typeof reviewEventSchema>;

export const reviewResultSchema = z.object({
   event: reviewEventSchema,
   state: learningStateSchema,
   remaining: z.number().int().nonnegative(),
});

export type ReviewResult = z.infer<typeof reviewResultSchema>;

/** Session detail includes the cards already reviewed, for resume. */
export const studySessionDetailSchema = studySessionSchema.extend({
   reviewedCardIds: z.array(idSchema),
});

export type StudySessionDetail = z.infer<typeof studySessionDetailSchema>;

export const listStudySessionsQuerySchema = z.object({
   status: sessionStatusSchema.optional(),
   limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type ListStudySessionsQuery = z.infer<typeof listStudySessionsQuerySchema>;

/** Body of `GET /study/recommendation` result: which plan and its source. */
export const studyRecommendationSchema = z.object({
   plan: studyPlanSchema,
   source: z.enum(['clef', 'scheduler']),
   evaluationId: idSchema.nullable(),
});

export type StudyRecommendation = z.infer<typeof studyRecommendationSchema>;
