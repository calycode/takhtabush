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
import { AccuracyTrendChart } from '../components/accuracy-trend-chart';
import { CardStateDonut } from '../components/card-state-donut';
import { DeckStatsOverview } from '../components/deck-stats-overview';
import { DueForecastChart } from '../components/due-forecast-chart';
import { ReviewHeatmap } from '../components/review-heatmap';

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

         <DeckStatsOverview stats={stats} />

         <div className='grid gap-4 lg:grid-cols-2'>
            <Card>
               <CardHeader>
                  <CardTitle>Card states</CardTitle>
                  <CardDescription>How the deck splits across the schedule.</CardDescription>
               </CardHeader>
               <CardContent>
                  <CardStateDonut stats={stats} />
               </CardContent>
            </Card>

            <Card>
               <CardHeader>
                  <CardTitle>Due forecast</CardTitle>
                  <CardDescription>Cards coming back over the next 14 days.</CardDescription>
               </CardHeader>
               <CardContent>
                  <DueForecastChart points={stats.dueForecast} />
               </CardContent>
            </Card>
         </div>

         <Card>
            <CardHeader>
               <CardTitle>Accuracy trend</CardTitle>
               <CardDescription>Daily accuracy over the last 16 weeks.</CardDescription>
            </CardHeader>
            <CardContent>
               <AccuracyTrendChart points={stats.accuracyTrend} />
            </CardContent>
         </Card>

         <Card>
            <CardHeader>
               <CardTitle>Review activity</CardTitle>
               <CardDescription>Reviews per day over the last 16 weeks.</CardDescription>
            </CardHeader>
            <CardContent>
               <ReviewHeatmap points={stats.activity} />
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
