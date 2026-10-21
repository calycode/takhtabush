import { useEffect, useState } from 'react';
import { buttonVariants } from '@caly/ui/components/button';
import {
   Card,
   CardContent,
   CardDescription,
   CardHeader,
   CardTitle,
} from '@caly/ui/components/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@caly/ui/components/empty';
import { Skeleton } from '@caly/ui/components/skeleton';
import { Alert, AlertDescription } from '@caly/ui/components/alert';
import { Badge } from '@caly/ui/components/badge';
import type { Deck, DeckStats, StudySession } from '@caly/shared';
import { ApiError } from '../lib/api/client';
import { listDecks } from '../lib/api/decks';
import { getDeckStats } from '../lib/api/stats';
import { listSessions } from '../lib/api/study';
import { DeckLibrary } from '../components/deck-library';

export function Home() {
   const [decks, setDecks] = useState<Deck[]>([]);
   const [sessions, setSessions] = useState<StudySession[]>([]);
   const [topStats, setTopStats] = useState<DeckStats | null>(null);
   const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'auth'>('loading');
   const [error, setError] = useState<string | null>(null);

   useEffect(() => {
      Promise.all([listDecks(), listSessions('active')])
         .then(async ([deckResult, sessionResult]) => {
            setDecks(deckResult.data);
            setSessions(sessionResult.data);
            setStatus('ready');
            const top = deckResult.data[0];
            if (top) {
               setTopStats(
                  await getDeckStats(top.id)
                     .then((r) => r.data)
                     .catch(() => null),
               );
            }
         })
         .catch((cause) => {
            if (cause instanceof ApiError && cause.status === 401) {
               setStatus('auth');
               return;
            }
            setError(cause instanceof ApiError ? cause.message : 'Failed to load decks');
            setStatus('error');
         });
   }, []);

   const deckName = (deckId: string) => decks.find((deck) => deck.id === deckId)?.title ?? 'Deck';
   const totalCards = decks.reduce((sum, deck) => sum + deck.cardCount, 0);
   const latest = decks[0];

   return (
      <section className='flex flex-col gap-6'>
         <div className='flex flex-col gap-2'>
            <h1 className='font-heading text-2xl font-medium'>Dashboard</h1>
            <p className='text-sm text-muted-foreground'>
               Your decks, cards, and study sessions on one Worker.
            </p>
         </div>

         {status === 'auth' && (
            <Alert variant='info'>
               <AlertDescription className='flex items-center justify-between gap-3'>
                  <span>Sign in to start studying.</span>
                  <a
                     href='/login'
                     className={buttonVariants({ size: 'sm' })}
                  >
                     Sign in
                  </a>
               </AlertDescription>
            </Alert>
         )}

         {status === 'error' && (
            <Alert variant='destructive'>
               <AlertDescription>{error}</AlertDescription>
            </Alert>
         )}

         <div className='grid gap-4 sm:grid-cols-3'>
            <StatCard
               title='Decks'
               value={decks.length}
               loading={status === 'loading'}
            />
            <StatCard
               title='Cards'
               value={totalCards}
               loading={status === 'loading'}
            />
            <StatCard
               title='Latest deck'
               value={latest?.title ?? '—'}
               loading={status === 'loading'}
            />
         </div>

         {sessions.length > 0 && (
            <Card>
               <CardHeader>
                  <CardTitle>Continue studying</CardTitle>
                  <CardDescription>
                     You have {sessions.length} session(s) in progress.
                  </CardDescription>
               </CardHeader>
               <CardContent className='flex flex-col gap-3'>
                  {sessions.map((session) => (
                     <div
                        key={session.id}
                        className='flex flex-wrap items-center justify-between gap-2'
                     >
                        <span className='flex items-center gap-2 text-sm'>
                           <Badge variant='outline'>{session.mode}</Badge>
                           {deckName(session.deckId)}
                           <span className='text-muted-foreground'>
                              · {new Date(session.startedAt).toLocaleString()}
                           </span>
                        </span>
                        <a
                           href={`/study/${session.id}`}
                           className={buttonVariants({ size: 'sm', variant: 'outline' })}
                        >
                           Resume
                        </a>
                     </div>
                  ))}
               </CardContent>
            </Card>
         )}

         <Card>
            <CardHeader>
               <CardTitle>Next steps</CardTitle>
               <CardDescription>
                  {latest
                     ? `Keep your learning going with “${latest.title}”.`
                     : 'Get set up to start learning.'}
               </CardDescription>
            </CardHeader>
            <CardContent>
               {status === 'loading' ? (
                  <Skeleton className='h-9 w-64' />
               ) : !latest ? (
                  <Empty className='border-0 py-0'>
                     <EmptyHeader>
                        <EmptyTitle>No decks yet</EmptyTitle>
                        <EmptyDescription>
                           Create a deck below to start building your flashcards.
                        </EmptyDescription>
                     </EmptyHeader>
                  </Empty>
               ) : (
                  <div className='flex flex-col gap-3'>
                     {topStats && topStats.weakCards.length > 0 && (
                        <Alert variant='info'>
                           <AlertDescription>
                              {topStats.weakCards.length} tricky card(s) in “{latest.title}” are
                              worth another look.
                           </AlertDescription>
                        </Alert>
                     )}
                     <div className='flex flex-wrap gap-2'>
                        <a
                           href={`/decks/${latest.id}`}
                           className={buttonVariants()}
                        >
                           Open {latest.title}
                        </a>
                        <a
                           href={`/stats/${latest.id}`}
                           className={buttonVariants({ variant: 'outline' })}
                        >
                           See progress
                        </a>
                     </div>
                  </div>
               )}
            </CardContent>
         </Card>

         <DeckLibrary />
      </section>
   );
}

function StatCard({
   title,
   value,
   loading,
}: {
   title: string;
   value: string | number;
   loading: boolean;
}) {
   return (
      <Card size='sm'>
         <CardHeader>
            <CardDescription>{title}</CardDescription>
            {loading ? (
               <Skeleton className='h-5 w-16' />
            ) : (
               <CardTitle className='text-lg'>{value}</CardTitle>
            )}
         </CardHeader>
      </Card>
   );
}
