import { describe, expect, it } from 'vitest';
import {
   DEFAULT_EASE,
   MIN_EASE,
   SCHEDULER_VERSION,
   isDue,
   newLearningState,
   rebuildLearningState,
   scheduleReview,
} from './scheduler';

const NOW = new Date('2026-01-01T00:00:00.000Z');

describe('scheduler', () => {
   it('starts new cards due immediately', () => {
      const state = newLearningState('usr_1', 'card_1', NOW);
      expect(state.schedulerVersion).toBe(SCHEDULER_VERSION);
      expect(state.ease).toBe(DEFAULT_EASE);
      expect(state.repetitions).toBe(0);
      expect(isDue(state, NOW)).toBe(true);
   });

   it('advances good reviews through 1 then 6 day intervals', () => {
      let state = newLearningState('usr_1', 'card_1', NOW);
      state = scheduleReview(state, 'good', NOW);
      expect(state.intervalDays).toBe(1);
      expect(state.repetitions).toBe(1);

      state = scheduleReview(state, 'good', NOW);
      expect(state.intervalDays).toBe(6);
      expect(state.repetitions).toBe(2);

      const ease = state.ease ?? DEFAULT_EASE;
      state = scheduleReview(state, 'good', NOW);
      expect(state.intervalDays).toBe(6 * ease);
   });

   it('resets repetitions and records a lapse on "again"', () => {
      let state = newLearningState('usr_1', 'card_1', NOW);
      state = scheduleReview(state, 'good', NOW);
      state = scheduleReview(state, 'again', NOW);
      expect(state.repetitions).toBe(0);
      expect(state.lapses).toBe(1);
      expect(state.intervalDays).toBe(0);
      expect(state.ease).toBeLessThan(DEFAULT_EASE);
   });

   it('never drops ease below the floor', () => {
      let state = newLearningState('usr_1', 'card_1', NOW);
      for (let i = 0; i < 20; i++) state = scheduleReview(state, 'again', NOW);
      expect(state.ease).toBe(MIN_EASE);
   });

   it('is deterministic and rebuildable from events', () => {
      const reviews = [
         { response: 'good' as const, reviewedAt: '2026-01-01T00:00:00.000Z' },
         { response: 'hard' as const, reviewedAt: '2026-01-02T00:00:00.000Z' },
         { response: 'easy' as const, reviewedAt: '2026-01-04T00:00:00.000Z' },
      ];
      const rebuilt = rebuildLearningState('usr_1', 'card_1', reviews, NOW);
      const rebuiltAgain = rebuildLearningState('usr_1', 'card_1', reviews, NOW);
      expect(rebuilt).toEqual(rebuiltAgain);
      expect(rebuilt.repetitions).toBe(3);
   });
});
