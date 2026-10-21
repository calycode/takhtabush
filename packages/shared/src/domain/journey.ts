import { z } from 'zod';
import { idSchema } from '../api/common';
import {
   estimateMinutes,
   journeyStrategySchema,
   maxCardsForMinutes,
   studyModeSchema,
   type JourneyStrategy,
   type StudyGoal,
   type StudyMode,
} from './modes';

/**
 * A server-generated study plan (SPEC §7.3). This is a deterministic default;
 * Clef may refine `strategy` through the API, but the card set and reasons are
 * always derived from real learning state.
 */
export const studyPlanSchema = z.object({
   sessionId: idSchema,
   mode: studyModeSchema,
   strategy: journeyStrategySchema,
   estimatedMinutes: z.number().int().nonnegative(),
   cardIds: z.array(idSchema),
   reasons: z.record(z.number()),
   fallbackUsed: z.boolean(),
});

export type StudyPlan = z.infer<typeof studyPlanSchema>;

export type JourneyInput = {
   sessionId: string;
   mode: StudyMode;
   goal: StudyGoal;
   minutes: number;
   /** Card ids currently due, most overdue first. */
   dueCardIds: string[];
   /** Card ids with low accuracy, worst first. */
   weakCardIds: string[];
   /** Card ids never reviewed. */
   newCardIds: string[];
   /** Optional explicit selection; when present it wins. */
   selectedCardIds?: string[];
};

const GOAL_STRATEGY: Record<StudyGoal, JourneyStrategy> = {
   learn: 'mixed',
   review: 'consolidate',
   cram: 'review_weak',
   retain: 'consolidate',
   diagnose: 'review_weak',
};

/** Order candidate cards by strategy, preserving input ordering within groups. */
function orderedCandidates(input: JourneyInput, strategy: JourneyStrategy): string[] {
   const { dueCardIds, weakCardIds, newCardIds } = input;
   const dedupe = (ids: string[]) => [...new Set(ids)];

   switch (strategy) {
      case 'review_weak':
         return dedupe([...weakCardIds, ...dueCardIds, ...newCardIds]);
      case 'consolidate':
         return dedupe([...dueCardIds, ...weakCardIds, ...newCardIds]);
      case 'new_material':
         return dedupe([...newCardIds, ...dueCardIds, ...weakCardIds]);
      case 'mixed':
      default: {
         const blended: string[] = [];
         const pools = [weakCardIds, dueCardIds, newCardIds];
         const maxLength = Math.max(0, ...pools.map((pool) => pool.length));
         for (let i = 0; i < maxLength; i++) {
            for (const pool of pools) if (pool[i]) blended.push(pool[i]);
         }
         return dedupe(blended);
      }
   }
}

function normalizedReasons(input: JourneyInput): Record<string, number> {
   const weak = input.weakCardIds.length;
   const due = input.dueCardIds.length;
   const fresh = input.newCardIds.length;
   const total = weak + due + fresh || 1;
   const round = (value: number) => Math.round((value / total) * 100) / 100;
   return {
      review_weak: round(weak),
      consolidate: round(due),
      new_material: round(fresh),
   };
}

/**
 * Build a deterministic study plan. Never throws for empty input — an empty
 * deck produces an empty plan so the UI can render an empty state.
 */
export function createJourneyPlan(input: JourneyInput): StudyPlan {
   const strategy = GOAL_STRATEGY[input.goal];
   const candidates = input.selectedCardIds?.length
      ? [...new Set(input.selectedCardIds)]
      : orderedCandidates(input, strategy);

   const limit = maxCardsForMinutes(input.minutes, input.mode);
   const cardIds = candidates.slice(0, limit);

   return {
      sessionId: input.sessionId,
      mode: input.mode,
      strategy,
      estimatedMinutes: estimateMinutes(cardIds.length, input.mode),
      cardIds,
      reasons: normalizedReasons(input),
      fallbackUsed: false,
   };
}
