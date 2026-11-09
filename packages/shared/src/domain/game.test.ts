import { describe, expect, it } from 'vitest';
import {
   advanceGameState,
   createGameState,
   gameCurrentCardId,
   gameScoreFor,
   GAME_LIVES,
} from './game';

describe('createGameState', () => {
   it('starts survival with a queue and three lives', () => {
      const game = createGameState('survival', ['card_1', 'card_2']);
      expect(game.kind).toBe('survival');
      expect(game.lives).toBe(GAME_LIVES);
      expect(game.queue).toEqual(['card_1', 'card_2']);
      expect(game.bosses).toEqual([]);
      expect(game.status).toBe('playing');
      expect(gameCurrentCardId(game)).toBe('card_1');
   });

   it('scales boss HP and caps the boss list', () => {
      const game = createGameState(
         'boss',
         Array.from({ length: 8 }, (_, index) => `card_${index + 1}`),
      );
      expect(game.bosses).toHaveLength(6);
      expect(game.bosses[0]).toMatchObject({ cardId: 'card_1', hp: 3, maxHp: 3 });
      expect(game.bosses[5]!.maxHp).toBe(6);
      expect(gameCurrentCardId(game)).toBe('card_1');
   });

   it('returns a completed state when there are no cards', () => {
      expect(createGameState('survival', []).status).toBe('won');
      expect(createGameState('boss', []).status).toBe('won');
   });
});

describe('gameScoreFor', () => {
   it('rewards combos and fast answers', () => {
      expect(gameScoreFor({ kind: 'survival', combo: 0 })).toBe(100);
      expect(gameScoreFor({ kind: 'survival', combo: 3 })).toBe(130);
      expect(gameScoreFor({ kind: 'boss', combo: 2, durationMs: 2000 })).toBe(190);
   });
});

describe('advanceGameState', () => {
   it('advances survival on a correct answer', () => {
      const start = createGameState('survival', ['card_1', 'card_2']);
      const next = advanceGameState(start, true, 1000);
      expect(next.queue).toEqual(['card_2']);
      expect(next.combo).toBe(1);
      expect(next.score).toBe(150);
      expect(next.status).toBe('playing');
   });

   it('retries a missed survival card and loses a life', () => {
      const start = createGameState('survival', ['card_1', 'card_2']);
      const next = advanceGameState(start, false);
      expect(next.queue).toEqual(['card_2', 'card_1']);
      expect(next.lives).toBe(GAME_LIVES - 1);
      expect(next.combo).toBe(0);
   });

   it('loses survival when the last life is spent', () => {
      const start = {
         ...createGameState('survival', ['card_1']),
         lives: 1,
      };
      const next = advanceGameState(start, false);
      expect(next.lives).toBe(0);
      expect(next.status).toBe('lost');
   });

   it('wins survival when the queue is cleared', () => {
      const start = createGameState('survival', ['card_1']);
      expect(advanceGameState(start, true).status).toBe('won');
   });

   it('chips boss HP and moves to the next boss', () => {
      const start = {
         ...createGameState('boss', ['card_1']),
         bosses: [{ cardId: 'card_1', hp: 1, maxHp: 1 }],
      };
      const next = advanceGameState(start, true);
      expect(next.bosses).toEqual([]);
      expect(next.bossesDefeated).toBe(1);
      expect(next.status).toBe('won');
   });

   it('keeps the same boss active while HP remains', () => {
      const start = createGameState('boss', ['card_1', 'card_2']);
      const next = advanceGameState(start, true);
      expect(next.bosses[0]?.cardId).toBe('card_1');
      expect(next.bosses[0]?.hp).toBe(2);
      expect(next.status).toBe('playing');
   });
});
