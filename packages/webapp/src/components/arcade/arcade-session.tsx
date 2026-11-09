import { useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { Alert, AlertDescription } from '@caly/ui/components/alert';
import { BitButton, BitProgress, EnemyHealthDisplay } from '@caly/ui/arcade';
import {
   cardAnswer,
   choiceOptionsFor,
   gameCurrentCardId,
   gradeFromPerformance,
   type Card,
   type GameState,
   type StudySessionDetail,
} from '@caly/shared';
import { ApiError } from '../../lib/api/client';
import { recordReview } from '../../lib/api/study';
import { toStudyCardData } from '../study/card-view';
import { ArcadeCabinet } from './arcade-cabinet';

export function ArcadeSession({
   session,
   cardsById,
   onGameUpdate,
   onGameEnd,
   onExit,
   onStats,
}: {
   session: StudySessionDetail;
   cardsById: Record<string, Card>;
   onGameUpdate: (game: GameState) => void;
   onGameEnd?: (game: GameState) => void;
   onExit: () => void;
   onStats: () => void;
}) {
   const game = session.game!;
   const [picked, setPicked] = useState<string | null>(null);
   const [result, setResult] = useState<'correct' | 'incorrect' | null>(null);
   const [busy, setBusy] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const startedAt = useRef(Date.now());
   const timer = useRef<number | undefined>(undefined);
   const notified = useRef(false);

   const currentCardId = gameCurrentCardId(game);
   const currentCard = currentCardId ? cardsById[currentCardId] : null;
   const currentData = currentCard ? toStudyCardData(currentCard) : null;
   const pool = useMemo(() => Object.values(cardsById).map(toStudyCardData), [cardsById]);
   const options = useMemo(
      () => (currentData ? choiceOptionsFor(currentData, pool) : []),
      [currentData, pool],
   );
   const correctValue = currentData ? cardAnswer(currentData) : '';
   const boss = game.bosses[0];

   useEffect(() => {
      setPicked(null);
      setResult(null);
      startedAt.current = Date.now();
   }, [currentCardId, game.answered]);

   useEffect(() => {
      if (game.status !== 'playing' && !notified.current) {
         notified.current = true;
         if (game.status === 'won') {
            confetti({
               particleCount: 180,
               spread: 90,
               origin: { y: 0.7 },
               disableForReducedMotion: true,
            });
         }
         onGameEnd?.(game);
      }
   }, [game, onGameEnd]);

   useEffect(() => {
      return () => {
         if (timer.current) clearTimeout(timer.current);
      };
   }, []);

   function answer(option: string) {
      if (!currentCard || busy || picked !== null) return;
      const correct = option === correctValue;
      const durationMs = Date.now() - startedAt.current;
      setPicked(option);
      setResult(correct ? 'correct' : 'incorrect');
      setBusy(true);

      timer.current = window.setTimeout(() => {
         void recordReview(session.id, {
            cardId: currentCard.id,
            response: gradeFromPerformance({ correct, durationMs, attempts: 1 }),
            durationMs,
         })
            .then((response) => {
               if (response.data.game) onGameUpdate(response.data.game);
            })
            .catch((cause) => {
               setError(cause instanceof ApiError ? cause.message : 'Failed to record the answer');
            })
            .finally(() => setBusy(false));
      }, 500);
   }

   if (game.status !== 'playing') {
      const won = game.status === 'won';
      return (
         <ArcadeCabinet
            statusLabel={won ? 'RUN COMPLETE' : 'RUN OVER'}
            statusDetail={`SCORE ${game.score.toLocaleString()}`}
            onClose={onExit}
         >
            <div className='flex flex-col items-center gap-5 text-center text-foreground'>
               <div>
                  <div className={`retro text-2xl ${won ? 'text-emerald-400' : 'text-red-500'}`}>
                     {won ? 'VICTORY!' : 'GAME OVER'}
                  </div>
                  <p className='retro mt-3 text-[8px] leading-relaxed text-muted-foreground'>
                     {won
                        ? game.kind === 'boss'
                           ? 'Every boss defeated.'
                           : 'You cleared the survival queue.'
                        : 'The run ended — the scheduler still saved every review.'}
                  </p>
               </div>

               <div className='grid w-full grid-cols-3 gap-2'>
                  <Stat
                     label='Score'
                     value={game.score.toLocaleString()}
                  />
                  <Stat
                     label='Best combo'
                     value={`x${game.bestCombo}`}
                  />
                  <Stat
                     label={game.kind === 'boss' ? 'Bosses' : 'Correct'}
                     value={game.kind === 'boss' ? game.bossesDefeated : game.correct}
                  />
               </div>

               <div className='flex flex-wrap justify-center gap-2'>
                  <BitButton onClick={onExit}>Back to deck</BitButton>
                  <BitButton
                     variant='outline'
                     onClick={onStats}
                  >
                     View stats
                  </BitButton>
               </div>
            </div>
         </ArcadeCabinet>
      );
   }

   const progressValue = game.kind === 'survival' ? game.answered : game.bossesDefeated;
   const progressTotal =
      game.kind === 'survival'
         ? game.answered + game.queue.length
         : game.bossesDefeated + game.bosses.length;

   return (
      <ArcadeCabinet
         statusLabel={game.kind === 'survival' ? 'SURVIVAL' : 'BOSS FIGHT'}
         statusDetail={`SCORE ${game.score.toLocaleString()}`}
         onClose={onExit}
      >
         <div className='flex flex-col gap-3 text-foreground'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
               <div className='flex items-center gap-3'>
                  <div className='border-4 border-foreground bg-black/70 px-3 py-1'>
                     <div className='retro text-[7px] text-muted-foreground'>SCORE</div>
                     <div className='retro text-sm text-amber-300'>
                        {game.score.toLocaleString()}
                     </div>
                  </div>
                  {game.combo > 1 && (
                     <div className='retro border-4 border-emerald-400 bg-emerald-950/60 px-2 py-1 text-[9px] text-emerald-300'>
                        COMBO x{game.combo}
                     </div>
                  )}
               </div>
               <div
                  className='flex items-center gap-2 border-4 border-foreground bg-black/70 px-3 py-1.5'
                  aria-label={`${game.lives} of ${game.maxLives} lives left`}
               >
                  <span className='retro text-[7px] text-muted-foreground'>LIVES</span>
                  <span
                     className={`retro flex gap-1.5 text-3xl leading-none ${
                        game.lives === 1 ? 'animate-pulse' : ''
                     }`}
                  >
                     {Array.from({ length: game.maxLives }, (_, index) => (
                        <span
                           key={index}
                           className={
                              index < game.lives
                                 ? 'text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.9)]'
                                 : 'text-muted-foreground/20'
                           }
                        >
                           ♥
                        </span>
                     ))}
                  </span>
               </div>
            </div>

            {game.kind === 'boss' && boss && currentCard && (
               <EnemyHealthDisplay
                  enemyName={currentCard.front}
                  level={game.bossesDefeated + 1}
                  currentHealth={boss.hp}
                  maxHealth={boss.maxHp}
                  healthBarColor='bg-red-500'
               />
            )}

            {game.kind === 'survival' && (
               <div className='flex flex-col gap-1'>
                  <BitProgress
                     value={progressValue}
                     max={Math.max(1, progressTotal)}
                  />
                  <span className='retro text-right text-[8px] text-muted-foreground'>
                     {progressValue} / {progressTotal}
                  </span>
               </div>
            )}

            {error && (
               <Alert variant='destructive'>
                  <AlertDescription>{error}</AlertDescription>
               </Alert>
            )}

            <div className='border-4 border-foreground/60 bg-[#0b1118] p-3'>
               <div className='retro text-[7px] uppercase text-muted-foreground'>PROMPT</div>
               <div className='mt-2 text-lg font-medium wrap-anywhere sm:text-xl'>
                  {currentCard?.front ?? 'Loading card…'}
               </div>
            </div>

            <div className='grid gap-3 sm:grid-cols-2'>
               {options.map((option) => {
                  const isCorrect = option === correctValue;
                  const isPicked = option === picked;
                  return (
                     <BitButton
                        key={option}
                        variant='outline'
                        className={
                           isPicked
                              ? `h-auto min-h-11 w-full justify-start whitespace-normal break-words px-3 py-3 text-left text-[10px] leading-relaxed ${
                                   isCorrect ? 'bg-emerald-600 text-white' : 'bg-red-700 text-white'
                                }`
                              : 'h-auto min-h-11 w-full justify-start whitespace-normal break-words px-3 py-3 text-left text-[10px] leading-relaxed'
                        }
                        disabled={busy || picked !== null}
                        onClick={() => answer(option)}
                     >
                        {option}
                     </BitButton>
                  );
               })}
            </div>

            {result && (
               <p
                  className={
                     result === 'correct'
                        ? 'retro text-center text-sm text-emerald-400'
                        : 'retro text-center text-sm text-red-500'
                  }
               >
                  {result === 'correct' ? 'CRITICAL HIT!' : 'MISS!'}
               </p>
            )}
            {result === 'incorrect' && (
               <p className='text-center text-xs text-muted-foreground'>
                  Correct answer: <span className='font-medium'>{correctValue}</span>
               </p>
            )}
         </div>
      </ArcadeCabinet>
   );
}

function Stat({ label, value }: { label: string; value: string | number }) {
   return (
      <div className='border-4 border-foreground/40 bg-[#0b1118] p-3'>
         <div className='retro text-[7px] text-muted-foreground uppercase'>{label}</div>
         <div className='retro mt-2 text-sm'>{value}</div>
      </div>
   );
}
