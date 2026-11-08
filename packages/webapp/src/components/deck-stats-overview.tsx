import { Card, CardDescription, CardHeader, CardTitle } from '@caly/ui/components/card';
import { Skeleton } from '@caly/ui/components/skeleton';
import type { DeckStats } from '@caly/shared';
import { StreakFlame } from './streak-flame';

const TILE_COUNT = 6;

/**
 * Headline deck metrics shared by the deck detail page and the statistics
 * page. Card-level detail (weak cards) stays on the statistics page.
 */
export function DeckStatsOverview({ stats }: { stats: DeckStats | null }) {
   if (!stats) {
      return (
         <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6'>
            {Array.from({ length: TILE_COUNT }, (_, index) => (
               <Skeleton
                  key={index}
                  className='h-[4.75rem]'
               />
            ))}
         </div>
      );
   }

   return (
      <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6'>
         <Metric
            label='Accuracy'
            value={stats.accuracy === null ? '—' : `${Math.round(stats.accuracy * 100)}%`}
         />
         <Metric
            label='Due now'
            value={stats.dueCards}
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
         <Card size='sm'>
            <CardHeader>
               <CardDescription>Streak</CardDescription>
               <StreakFlame days={stats.streak} />
            </CardHeader>
         </Card>
      </div>
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
