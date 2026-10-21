import { z } from 'zod';
import { idSchema, isoDateSchema } from '../api/common';
import type { ReviewResponse } from './modes';

/**
 * Versioning for the deterministic scheduler (SPEC §7.2).
 *
 * Bump this whenever {@link scheduleReview} changes its math. The version is
 * stored per `learning_state` row so old rows can be migrated or rebuilt.
 */
export const SCHEDULER_VERSION = 1;

export const MIN_EASE = 1.3;
export const MAX_EASE = 2.8;
export const DEFAULT_EASE = 2.5;
export const AGAIN_DELAY_MINUTES = 10;
export const DAY_MS = 24 * 60 * 60 * 1000;

export const learningStateSchema = z.object({
   userId: idSchema,
   cardId: idSchema,
   schedulerVersion: z.number().int().positive(),
   state: z.record(z.unknown()),
   dueAt: isoDateSchema.nullable(),
   intervalDays: z.number().nonnegative().nullable(),
   ease: z.number().nullable(),
   repetitions: z.number().int().nonnegative(),
   lapses: z.number().int().nonnegative(),
   lastReviewedAt: isoDateSchema.nullable(),
});

export type LearningState = z.infer<typeof learningStateSchema>;

function clamp(value: number, min: number, max: number): number {
   return Math.max(min, Math.min(max, value));
}

/** A brand-new card, due immediately. */
export function newLearningState(userId: string, cardId: string, now: Date): LearningState {
   return {
      userId,
      cardId,
      schedulerVersion: SCHEDULER_VERSION,
      state: { phase: 'new' },
      dueAt: now.toISOString(),
      intervalDays: 0,
      ease: DEFAULT_EASE,
      repetitions: 0,
      lapses: 0,
      lastReviewedAt: null,
   };
}

/**
 * SM-2-inspired transition (SPEC §7.2).
 *
 * Deterministic: the same state, response, and clock always produce the same
 * next state. `review_events` remain the source of truth and `learning_state`
 * can be rebuilt by folding this function over them.
 */
export function scheduleReview(
   state: LearningState,
   response: ReviewResponse,
   now: Date,
): LearningState {
   const ease = state.ease ?? DEFAULT_EASE;
   const interval = state.intervalDays ?? 0;
   const repetitions = state.repetitions;
   const lapses = state.lapses;

   let nextEase = ease;
   let nextInterval = interval;
   let nextRepetitions = repetitions;
   let nextLapses = lapses;
   let phase: string;

   switch (response) {
      case 'again': {
         nextEase = clamp(ease - 0.2, MIN_EASE, MAX_EASE);
         nextInterval = 0;
         nextRepetitions = 0;
         nextLapses = lapses + 1;
         phase = 'relearning';
         break;
      }
      case 'hard': {
         nextEase = clamp(ease - 0.15, MIN_EASE, MAX_EASE);
         nextInterval = Math.max(1, interval * 1.2);
         nextRepetitions = repetitions + 1;
         phase = 'review';
         break;
      }
      case 'easy': {
         nextEase = clamp(ease + 0.15, MIN_EASE, MAX_EASE);
         nextInterval = repetitions === 0 ? 3 : Math.max(1, interval * nextEase * 1.3);
         nextRepetitions = repetitions + 1;
         phase = 'review';
         break;
      }
      case 'good':
      default: {
         nextInterval =
            repetitions === 0 ? 1 : repetitions === 1 ? 6 : Math.max(1, interval * ease);
         nextRepetitions = repetitions + 1;
         phase = 'review';
         break;
      }
   }

   nextInterval = Math.round(nextInterval * 100) / 100;

   const dueAt =
      response === 'again'
         ? new Date(now.getTime() + AGAIN_DELAY_MINUTES * 60 * 1000)
         : new Date(now.getTime() + nextInterval * DAY_MS);

   return {
      ...state,
      schedulerVersion: SCHEDULER_VERSION,
      state: { phase, lastResponse: response, intervalDays: nextInterval, ease: nextEase },
      dueAt: dueAt.toISOString(),
      intervalDays: nextInterval,
      ease: nextEase,
      repetitions: nextRepetitions,
      lapses: nextLapses,
      lastReviewedAt: now.toISOString(),
   };
}

/** Whether a card should appear in a due queue right now. */
export function isDue(state: LearningState, now: Date): boolean {
   if (!state.dueAt) return true;
   return new Date(state.dueAt).getTime() <= now.getTime();
}

/** Fold a sequence of reviews onto a fresh state (rebuild path, SPEC §7.2). */
export function rebuildLearningState(
   userId: string,
   cardId: string,
   reviews: Array<{ response: ReviewResponse; reviewedAt: string }>,
   now: Date,
): LearningState {
   let state = newLearningState(
      userId,
      cardId,
      new Date(reviews[0]?.reviewedAt ?? now.toISOString()),
   );
   for (const review of reviews) {
      state = scheduleReview(state, review.response, new Date(review.reviewedAt));
   }
   return state;
}
