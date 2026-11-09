import { useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { Alert, AlertDescription } from '@caly/ui/components/alert';
import { Badge } from '@caly/ui/components/badge';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@caly/ui/components/card';
import { BitButton, BitCard, BitProgress, EnemyHealthDisplay } from '@caly/ui/arcade';
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
         <section className='mx-auto flex w-full max-w-2xl flex-col gap-4'>
            <BitCard className={won ? 'border-emerald-500' : 'border-red-600'}>
               <CardHeader className='items-center text-center'>
                  <CardTitle
                     className={
                        won ? 'retro text-2xl text-emerald-500' : 'retro text-2xl text-red-500'
                     }
                  >
                     {won ? 'VICTORY!' : 'GAME OVER'}
                  </CardTitle>
                  <CardDescription className='retro text-[9px]'>
                     {won
                        ? game.kind === 'boss'
                           ? 'Every boss defeated.'
                           : 'You cleared the survival queue.'
                        : 'The run ended — the scheduler still saved every review.'}
                  </CardDescription>
               </CardHeader>
               <CardContent className='flex flex-col gap-5'>
                  <div className='grid grid-cols-3 gap-2 text-center'>
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
               </CardContent>
            </BitCard>
         </section>
      );
   }

   const progressValue = game.kind === 'survival' ? game.answered : game.bossesDefeated;
   const progressTotal =
      game.kind === 'survival'
         ? game.answered + game.queue.length
         : game.bossesDefeated + game.bosses.length;

   return (
      <section className='mx-auto flex w-full max-w-2xl flex-col gap-4'>
         <div className='flex flex-wrap items-center justify-between gap-3'>
            <div className='flex flex-wrap items-center gap-2'>
               <Badge
                  variant='outline'
                  className='retro text-[9px]'
               >
                  {game.kind === 'survival' ? 'SURVIVAL' : 'BOSS FIGHT'}
               </Badge>
               <span className='retro text-[10px] text-muted-foreground'>
                  SCORE {game.score.toLocaleString()}
               </span>
               {game.combo > 1 && (
                  <span className='retro text-[10px] text-amber-500'>COMBO x{game.combo}</span>
               )}
            </div>
            <div className='flex items-center gap-2'>
               <span
                  className='retro flex gap-1 text-sm'
                  aria-label={`${game.lives} of ${game.maxLives} lives left`}
               >
                  {Array.from({ length: game.maxLives }, (_, index) => (
                     <span
                        key={index}
                        className={index < game.lives ? 'text-red-500' : 'text-muted-foreground/30'}
                     >
                        ♥
                     </span>
                  ))}
               </span>
               <BitButton
                  variant='ghost'
                  size='sm'
                  onClick={onExit}
               >
                  Exit
               </BitButton>
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

         <BitCard font='normal'>
            <CardHeader>
               <CardDescription className='retro text-[8px] uppercase'>Prompt</CardDescription>
               <CardTitle className='text-lg wrap-anywhere sm:text-xl'>
                  {currentCard?.front ?? 'Loading card…'}
               </CardTitle>
            </CardHeader>
            <CardContent className='flex flex-col gap-3'>
               <div className='grid gap-2 sm:grid-cols-2'>
                  {options.map((option) => {
                     const isCorrect = option === correctValue;
                     const isPicked = option === picked;
                     return (
                        <BitButton
                           key={option}
                           variant='outline'
                           className={
                              isPicked
                                 ? isCorrect
                                    ? 'min-h-11 bg-emerald-600 text-white'
                                    : 'min-h-11 bg-red-700 text-white'
                                 : 'min-h-11 whitespace-normal text-left text-[9px] leading-relaxed'
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
                           ? 'retro text-center text-sm text-emerald-500'
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
            </CardContent>
         </BitCard>
      </section>
   );
}

function Stat({ label, value }: { label: string; value: string | number }) {
   return (
      <div className='border-2 border-foreground/20 p-3'>
         <div className='retro text-[8px] text-muted-foreground uppercase'>{label}</div>
         <div className='retro mt-2 text-sm'>{value}</div>
      </div>
   );
}
