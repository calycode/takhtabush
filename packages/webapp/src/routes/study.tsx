import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'preact-iso';
import { Button, buttonVariants } from '@caly/ui/components/button';
import { Progress } from '@caly/ui/components/progress';
import { Skeleton } from '@caly/ui/components/skeleton';
import { Alert, AlertDescription } from '@caly/ui/components/alert';
import { Badge } from '@caly/ui/components/badge';
import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
} from '@caly/ui/components/dialog';
import { gradeFromPerformance } from '@caly/shared';
import type {
   Card as CardType,
   MatchingVariant,
   ReviewResponse,
   StudySessionDetail,
} from '@caly/shared';
import { ApiError } from '../lib/api/client';
import { listAllDeckCards } from '../lib/api/decks';
import { abandonSession, completeSession, getSession, recordReview } from '../lib/api/study';
import { MatchingPairs, type PairSignals } from '@caly/ui/study';
import { StudyCard, interactionFor, toStudyCardData } from '../components/study/card-view';

const MATCHING_PAGE_SIZE = 4;

export function StudySession({ sessionId }: { sessionId?: string }) {
   const { route } = useLocation();
   const id = sessionId ?? '';
   const [session, setSession] = useState<StudySessionDetail | null>(null);
   const [cardsById, setCardsById] = useState<Record<string, CardType>>({});
   const [index, setIndex] = useState(0);
   const [matchedInBatch, setMatchedInBatch] = useState(0);
   const [matchingVariant, setMatchingVariant] = useState<MatchingVariant>(() =>
      new URLSearchParams(window.location.search).get('variant') === 'choice' ? 'choice' : 'pairs',
   );
   const [done, setDone] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [busy, setBusy] = useState(false);
   const [exitOpen, setExitOpen] = useState(false);

   useEffect(() => {
      (async () => {
         try {
            const result = await getSession(id);
            const deckCards = await listAllDeckCards(result.data.deckId);
            setSession(result.data);
            setCardsById(Object.fromEntries(deckCards.map((card) => [card.id, card])));
         } catch (cause) {
            setError(cause instanceof ApiError ? cause.message : 'Failed to load session');
         }
      })();
   }, [id]);

   const reviewed = useMemo(() => new Set(session?.reviewedCardIds ?? []), [session]);
   const total = session?.plannedCardIds.length ?? 0;
   const queue = useMemo(
      () =>
         session
            ? session.plannedCardIds.filter((cardId) => cardsById[cardId] && !reviewed.has(cardId))
            : [],
      [session, cardsById, reviewed],
   );
   const current = queue[index] ? cardsById[queue[index]] : null;
   const pool = useMemo(
      () => queue.map((cardId) => cardsById[cardId]).filter(Boolean),
      [queue, cardsById],
   );
   const batch = useMemo(
      () => queue.slice(index, index + MATCHING_PAGE_SIZE).map((cardId) => cardsById[cardId]),
      [queue, index, cardsById],
   );
   const pairCards = useMemo(() => batch.map(toStudyCardData), [batch]);

   const finish = useCallback(async () => {
      await completeSession(id);
      setDone(true);
   }, [id]);

   const grade = useCallback(
      async (response: ReviewResponse) => {
         if (!current || busy) return;
         setBusy(true);
         try {
            await recordReview(id, { cardId: current.id, response });
            if (index + 1 >= queue.length) await finish();
            else setIndex((value) => value + 1);
         } catch (cause) {
            setError(cause instanceof ApiError ? cause.message : 'Failed to record review');
         } finally {
            setBusy(false);
         }
      },
      [current, busy, id, index, queue.length, finish],
   );

   const recordPair = useCallback(
      async (card: { id: string }, signals: PairSignals) => {
         setMatchedInBatch((value) => value + 1);
         const response = gradeFromPerformance({ correct: true, ...signals });
         try {
            await recordReview(id, { cardId: card.id, response });
         } catch (cause) {
            setError(cause instanceof ApiError ? cause.message : 'Failed to record review');
         }
      },
      [id],
   );

   function advanceBatch(size: number) {
      setMatchedInBatch(0);
      if (index + size >= queue.length) void finish();
      else setIndex((value) => value + size);
   }

   /** Leave the session active so it can be resumed from the dashboard. */
   function pauseAndExit() {
      setExitOpen(false);
      route(`/decks/${session?.deckId ?? ''}`);
   }

   /** Explicitly abandon the session (marks it abandoned). */
   async function abandonAndExit() {
      setExitOpen(false);
      if (session && session.status === 'active' && !done) {
         await abandonSession(id).catch(() => undefined);
      }
      route(`/decks/${session?.deckId ?? ''}`);
   }

   if (error) {
      return (
         <Alert variant='destructive'>
            <AlertDescription>{error}</AlertDescription>
         </Alert>
      );
   }

   if (!session) return <Skeleton className='h-48' />;

   const complete = done || (total > 0 && queue.length === 0 && reviewed.size > 0);
   if (complete) {
      return (
         <section className='mx-auto flex max-w-lg flex-col items-center gap-4 text-center'>
            <h1 className='font-heading text-2xl font-medium'>Session complete</h1>
            <p className='text-sm text-muted-foreground'>You reviewed {total} cards.</p>
            <div className='flex gap-2'>
               <a
                  href={`/decks/${session.deckId}`}
                  className={buttonVariants()}
               >
                  Back to deck
               </a>
               <a
                  href={`/stats/${session.deckId}`}
                  className={buttonVariants({ variant: 'outline' })}
               >
                  View statistics
               </a>
            </div>
         </section>
      );
   }

   if (total === 0) {
      return (
         <section className='mx-auto flex max-w-lg flex-col items-center gap-4 text-center'>
            <h1 className='font-heading text-2xl font-medium'>Nothing to study</h1>
            <p className='text-sm text-muted-foreground'>This deck has no cards yet.</p>
            <a
               href={`/decks/${session.deckId}`}
               className={buttonVariants()}
            >
               Add cards
            </a>
         </section>
      );
   }

   const isPairs = session.mode === 'matching' && matchingVariant === 'pairs';
   const answered = Math.min(reviewed.size + index + (isPairs ? matchedInBatch : 0), total);

   const HINTS = {
      flashcards: 'Space to reveal · 1–4 to grade · Esc to exit',
      choice: 'Choose the correct option',
      typed: 'Type your answer, then press Enter',
      cloze: 'Fill in the blank, then press Enter',
   } as const;
   const hint = isPairs
      ? 'Pick a term, then its match.'
      : current
        ? HINTS[interactionFor(current, session.mode)]
        : '';

   return (
      <section className='mx-auto flex max-w-2xl flex-col gap-4'>
         <div className='flex items-center justify-between gap-3'>
            <div className='flex items-center gap-2'>
               <Badge variant='outline'>{session.mode}</Badge>
               {reviewed.size > 0 && <Badge variant='secondary'>resumed</Badge>}
               {session.mode === 'matching' && (
                  <div className='flex gap-1'>
                     {(['pairs', 'choice'] as const).map((variant) => (
                        <Button
                           key={variant}
                           variant={matchingVariant === variant ? 'default' : 'outline'}
                           size='xs'
                           onClick={() => setMatchingVariant(variant)}
                        >
                           {variant === 'pairs' ? 'Pairs' : 'Choice'}
                        </Button>
                     ))}
                  </div>
               )}
            </div>
            <span className='text-xs text-muted-foreground'>
               {answered} / {total}
            </span>
            <Button
               variant='ghost'
               size='sm'
               onClick={() => setExitOpen(true)}
            >
               Exit
            </Button>
         </div>
         <Progress
            value={answered}
            max={total}
         />

         {isPairs ? (
            <MatchingPairs
               key={batch.map((card) => card.id).join(',')}
               cards={pairCards}
               busy={busy}
               onPair={(card, signals) => void recordPair(card, signals)}
               onComplete={() => advanceBatch(batch.length)}
            />
         ) : (
            current && (
               <StudyCard
                  key={current.id}
                  card={current}
                  mode={session.mode}
                  pool={pool}
                  busy={busy}
                  onAnswered={(response) => void grade(response)}
               />
            )
         )}

         <p className='text-center text-xs text-muted-foreground'>{hint}</p>

         <Dialog
            open={exitOpen}
            onOpenChange={setExitOpen}
         >
            <DialogContent>
               <DialogHeader>
                  <DialogTitle>Leave this session?</DialogTitle>
                  <DialogDescription>
                     Your progress is saved — you can resume from the dashboard. Or abandon the
                     session to remove it from your active list.
                  </DialogDescription>
               </DialogHeader>
               <DialogFooter>
                  <Button
                     variant='outline'
                     onClick={pauseAndExit}
                  >
                     Pause &amp; resume later
                  </Button>
                  <Button
                     variant='destructive'
                     onClick={() => void abandonAndExit()}
                  >
                     Abandon session
                  </Button>
               </DialogFooter>
            </DialogContent>
         </Dialog>
      </section>
   );
}
