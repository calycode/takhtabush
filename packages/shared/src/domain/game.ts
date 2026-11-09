import { z } from 'zod';
import { idSchema } from '../api/common';

export const gameModeSchema = z.enum(['survival', 'boss']);
export type GameMode = z.infer<typeof gameModeSchema>;

export const gameStatusSchema = z.enum(['playing', 'won', 'lost']);
export type GameStatus = z.infer<typeof gameStatusSchema>;

export const gameBossSchema = z.object({
   cardId: idSchema,
   hp: z.number().int().nonnegative(),
   maxHp: z.number().int().positive(),
});
export type GameBoss = z.infer<typeof gameBossSchema>;

/**
 * Authoritative arcade state. Survival stores the retry queue; boss stores the
 * remaining bosses (the first entry is the active one).
 */
export const gameStateSchema = z.object({
   kind: gameModeSchema,
   status: gameStatusSchema,
   lives: z.number().int().nonnegative(),
   maxLives: z.number().int().positive(),
   score: z.number().int().nonnegative(),
   combo: z.number().int().nonnegative(),
   bestCombo: z.number().int().nonnegative(),
   answered: z.number().int().nonnegative(),
   correct: z.number().int().nonnegative(),
   queue: z.array(idSchema),
   bosses: z.array(gameBossSchema),
   bossesDefeated: z.number().int().nonnegative(),
   startedAt: z.string(),
});

export type GameState = z.infer<typeof gameStateSchema>;

export const GAME_LIVES = 3;

/** Build the initial authoritative state for a new arcade session. */
export function createGameState(kind: GameMode, cardIds: string[]): GameState {
   const startedAt = new Date().toISOString();
   if (kind === 'boss') {
      const bosses = cardIds.slice(0, 6).map((cardId, index) => {
         const maxHp = Math.min(6, 3 + index);
         return { cardId, hp: maxHp, maxHp };
      });
      return {
         kind,
         status: bosses.length > 0 ? 'playing' : 'won',
         lives: GAME_LIVES,
         maxLives: GAME_LIVES,
         score: 0,
         combo: 0,
         bestCombo: 0,
         answered: 0,
         correct: 0,
         queue: [],
         bosses,
         bossesDefeated: 0,
         startedAt,
      };
   }

   return {
      kind,
      status: cardIds.length > 0 ? 'playing' : 'won',
      lives: GAME_LIVES,
      maxLives: GAME_LIVES,
      score: 0,
      combo: 0,
      bestCombo: 0,
      answered: 0,
      correct: 0,
      queue: [...cardIds],
      bosses: [],
      bossesDefeated: 0,
      startedAt,
   };
}

/** The card the player must answer next, or null when the game is over. */
export function gameCurrentCardId(game: GameState): string | null {
   if (game.kind === 'boss') return game.bosses[0]?.cardId ?? null;
   return game.queue[0] ?? null;
}

export function gameScoreFor(input: {
   kind: GameMode;
   combo: number;
   durationMs?: number;
}): number {
   const base = input.kind === 'boss' ? 120 : 100;
   const comboBonus = Math.min(input.combo, 10) * 10;
   const speedBonus = input.durationMs !== undefined && input.durationMs <= 3000 ? 50 : 0;
   return base + comboBonus + speedBonus;
}

/**
 * Advance an arcade run by one answer. Survival retries a missed card at the
 * back of the queue; boss fights chip one HP off the active boss.
 */
export function advanceGameState(
   game: GameState,
   correct: boolean,
   durationMs?: number,
): GameState {
   const combo = correct ? game.combo + 1 : 0;
   const next: GameState = {
      ...game,
      combo,
      bestCombo: Math.max(game.bestCombo, combo),
      score:
         game.score +
         (correct ? gameScoreFor({ kind: game.kind, combo: game.combo, durationMs }) : 0),
      answered: game.answered + 1,
      correct: game.correct + (correct ? 1 : 0),
   };

   if (game.kind === 'survival') {
      const cardId = game.queue[0];
      const queue = game.queue.slice(1);
      next.queue = queue;
      if (!correct) {
         next.lives = Math.max(0, game.lives - 1);
         if (next.lives > 0 && cardId) next.queue = [...queue, cardId];
      }
      if (next.lives <= 0) next.status = 'lost';
      else if (next.queue.length === 0) next.status = 'won';
      return next;
   }

   const bosses = [...game.bosses];
   const boss = bosses[0];
   if (boss) {
      if (correct) {
         const hp = Math.max(0, boss.hp - 1);
         bosses[0] = { ...boss, hp };
         if (hp === 0) {
            bosses.shift();
            next.bossesDefeated = game.bossesDefeated + 1;
         }
      } else {
         next.lives = Math.max(0, game.lives - 1);
      }
      next.bosses = bosses;
   }
   if (next.lives <= 0) next.status = 'lost';
   else if (next.bosses.length === 0) next.status = 'won';
   return next;
}
