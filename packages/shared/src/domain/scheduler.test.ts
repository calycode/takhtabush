import { describe, expect, it } from 'vitest';
import {
   DEFAULT_EASE,
   HARD_NEW_INTERVAL_DAYS,
   INTERVAL_FUZZ,
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

   it('advances good reviews through 1 then ~6 day intervals', () => {
      let state = newLearningState('usr_1', 'card_1', NOW);
      state = scheduleReview(state, 'good', NOW);
      expect(state.intervalDays).toBe(1);
      expect(state.repetitions).toBe(1);

      state = scheduleReview(state, 'good', NOW);
      expect(state.intervalDays).toBeGreaterThanOrEqual(6 * (1 - INTERVAL_FUZZ));
      expect(state.intervalDays).toBeLessThanOrEqual(6 * (1 + INTERVAL_FUZZ));
      expect(state.repetitions).toBe(2);
   });

   it('brings a new card graded hard back before one graded good', () => {
      const hard = scheduleReview(newLearningState('usr_1', 'card_1', NOW), 'hard', NOW);
      const good = scheduleReview(newLearningState('usr_1', 'card_1', NOW), 'good', NOW);
      expect(hard.intervalDays).toBe(HARD_NEW_INTERVAL_DAYS);
      expect(hard.intervalDays ?? 0).toBeLessThan(good.intervalDays ?? 0);
   });

   it('fuzzes long intervals deterministically within the spread', () => {
      const base = newLearningState('usr_1', 'card_1', NOW);
      const first = scheduleReview(base, 'easy', NOW);
      const second = scheduleReview(base, 'easy', NOW);
      expect(first.intervalDays).toBe(second.intervalDays);

      let state = base;
      for (let i = 0; i < 6; i++) state = scheduleReview(state, 'good', NOW);
      const previous = state.intervalDays ?? 0;
      expect(previous).toBeGreaterThan(2);

      const expected = previous * (state.ease ?? DEFAULT_EASE);
      const next = scheduleReview(state, 'good', NOW);
      expect(next.intervalDays).toBeGreaterThanOrEqual(expected * (1 - INTERVAL_FUZZ) - 0.01);
      expect(next.intervalDays).toBeLessThanOrEqual(expected * (1 + INTERVAL_FUZZ) + 0.01);
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
