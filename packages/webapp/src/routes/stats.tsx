import { useEffect, useState } from 'react';
import { buttonVariants } from '@caly/ui/components/button';
import {
   Card,
   CardContent,
   CardDescription,
   CardHeader,
   CardTitle,
} from '@caly/ui/components/card';
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from '@caly/ui/components/table';
import { Badge } from '@caly/ui/components/badge';
import { Skeleton } from '@caly/ui/components/skeleton';
import { Alert, AlertDescription } from '@caly/ui/components/alert';
import type { DeckStats } from '@caly/shared';
import { ApiError } from '../lib/api/client';
import { getDeckStats } from '../lib/api/stats';

export function StatsView({ deckId }: { deckId?: string }) {
   const id = deckId ?? '';
   const [stats, setStats] = useState<DeckStats | null>(null);
   const [error, setError] = useState<string | null>(null);

   useEffect(() => {
      getDeckStats(id)
         .then((result) => setStats(result.data))
         .catch((cause) =>
            setError(cause instanceof ApiError ? cause.message : 'Failed to load stats'),
         );
   }, [id]);

   if (error) {
      return (
         <Alert variant='destructive'>
            <AlertDescription>{error}</AlertDescription>
         </Alert>
      );
   }

   if (!stats) return <Skeleton className='h-48' />;

   return (
      <section className='flex flex-col gap-6'>
         <div className='flex items-center justify-between gap-3'>
            <h1 className='font-heading text-2xl font-medium'>Statistics</h1>
            <a
               href={`/decks/${id}`}
               className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
               Back to deck
            </a>
         </div>

         <div className='grid gap-4 sm:grid-cols-3'>
            <Metric
               label='Accuracy'
               value={stats.accuracy === null ? '—' : `${Math.round(stats.accuracy * 100)}%`}
            />
            <Metric
               label='Due now'
               value={stats.dueCards}
            />
            <Metric
               label='Streak'
               value={`${stats.streak}d`}
            />
            <Metric
               label='New'
               value={stats.newCards}
            />
            <Metric
               label='Learning'
               value={stats.learningCards}
            />
            <Metric
               label='Reviews'
               value={stats.totalReviews}
            />
         </div>

         <Card>
            <CardHeader>
               <CardTitle>Current schedule</CardTitle>
               <CardDescription>When your cards come back around (next 14 days).</CardDescription>
            </CardHeader>
            <CardContent>
               {stats.dueForecast.length === 0 ? (
                  <p className='text-sm text-muted-foreground'>Nothing scheduled.</p>
               ) : (
                  <Table>
                     <TableHeader>
                        <TableRow>
                           <TableHead>Date</TableHead>
                           <TableHead>Count</TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {stats.dueForecast.map((point) => (
                           <TableRow key={point.date}>
                              <TableCell>{point.date}</TableCell>
                              <TableCell>{point.count}</TableCell>
                           </TableRow>
                        ))}
                     </TableBody>
                  </Table>
               )}
            </CardContent>
         </Card>

         <Card>
            <CardHeader>
               <CardTitle>Card accuracy</CardTitle>
               <CardDescription>Your cards, lowest accuracy first.</CardDescription>
            </CardHeader>
            <CardContent>
               {stats.weakCards.length === 0 ? (
                  <p className='text-sm text-muted-foreground'>No reviews yet.</p>
               ) : (
                  <Table>
                     <TableHeader>
                        <TableRow>
                           <TableHead>Card</TableHead>
                           <TableHead>Accuracy</TableHead>
                           <TableHead>Lapses</TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {stats.weakCards.map((card) => (
                           <TableRow key={card.cardId}>
                              <TableCell>{card.front}</TableCell>
                              <TableCell>
                                 <Badge variant='outline'>{Math.round(card.accuracy * 100)}%</Badge>
                              </TableCell>
                              <TableCell>{card.lapses}</TableCell>
                           </TableRow>
                        ))}
                     </TableBody>
                  </Table>
               )}
            </CardContent>
         </Card>
      </section>
   );
}

function Metric({ label, value }: { label: string; value: string | number }) {
   return (
      <Card size='sm'>
         <CardHeader>
            <CardDescription>{label}</CardDescription>
            <CardTitle className='text-lg'>{value}</CardTitle>
         </CardHeader>
      </Card>
   );
}
