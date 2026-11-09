import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@caly/ui/components/badge';
import { CardDescription, CardHeader, CardTitle } from '@caly/ui/components/card';
import { Alert, AlertDescription } from '@caly/ui/components/alert';
import { Skeleton } from '@caly/ui/components/skeleton';
import { BitCard } from '@caly/ui/arcade';
import {
   ACHIEVEMENT_CATEGORY_LABELS,
   type Achievement,
   type AchievementCategory,
   type AchievementsResponse,
} from '@caly/shared';
import { ApiError } from '../lib/api/client';
import { getAchievements } from '../lib/api/achievements';

const CATEGORY_ORDER: AchievementCategory[] = [
   'starter',
   'consistency',
   'volume',
   'accuracy',
   'mastery',
   'explorer',
   'arcade',
   'social',
];

export function AchievementsPage() {
   const [data, setData] = useState<AchievementsResponse | null>(null);
   const [error, setError] = useState<string | null>(null);

   useEffect(() => {
      getAchievements()
         .then((result) => setData(result.data))
         .catch((cause) =>
            setError(cause instanceof ApiError ? cause.message : 'Failed to load achievements'),
         );
   }, []);

   const groups = useMemo(() => {
      if (!data) return [];
      return CATEGORY_ORDER.map((category) => ({
         category,
         items: data.items.filter((item) => item.category === category),
      })).filter((group) => group.items.length > 0);
   }, [data]);

   if (error) {
      return (
         <Alert variant='destructive'>
            <AlertDescription>{error}</AlertDescription>
         </Alert>
      );
   }

   if (!data) return <Skeleton className='h-64' />;

   const unlocked = data.items.filter((item) => item.unlockedAt).length;

   return (
      <section className='flex flex-col gap-8'>
         <div className='flex flex-wrap items-end justify-between gap-3'>
            <div className='flex flex-col gap-2'>
               <h1 className='font-heading text-2xl font-medium'>Achievements</h1>
               <p className='text-sm text-muted-foreground'>
                  {unlocked} of {data.items.length} unlocked. Keep showing up.
               </p>
            </div>
            <Badge variant='secondary'>{data.pending.length} new</Badge>
         </div>

         {groups.map((group) => (
            <section
               key={group.category}
               className='flex flex-col gap-3'
            >
               <h2 className='font-heading text-sm font-medium tracking-wide uppercase'>
                  {ACHIEVEMENT_CATEGORY_LABELS[group.category]}
               </h2>
               <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
                  {group.items.map((achievement) => (
                     <AchievementCard
                        key={achievement.id}
                        achievement={achievement}
                     />
                  ))}
               </div>
            </section>
         ))}
      </section>
   );
}

function AchievementCard({ achievement }: { achievement: Achievement }) {
   const unlocked = Boolean(achievement.unlockedAt);
   return (
      <BitCard
         font='normal'
         className={unlocked ? 'bg-card' : 'bg-muted/20 opacity-60'}
      >
         <CardHeader className='flex flex-row items-start gap-3'>
            <span
               className='text-3xl'
               aria-hidden='true'
            >
               {unlocked ? achievement.icon : '🔒'}
            </span>
            <div className='min-w-0 flex-1'>
               <div className='flex flex-wrap items-center gap-1.5'>
                  <CardTitle className='text-sm'>{achievement.title}</CardTitle>
                  <Badge
                     variant={unlocked ? 'secondary' : 'outline'}
                     className='retro text-[8px] uppercase'
                  >
                     {achievement.tier}
                  </Badge>
               </div>
               <CardDescription className='mt-1'>{achievement.description}</CardDescription>
               <p className='retro mt-2 text-[8px] text-muted-foreground'>
                  {unlocked
                     ? `Unlocked ${new Date(achievement.unlockedAt!).toLocaleDateString()}`
                     : 'Locked'}
               </p>
            </div>
         </CardHeader>
      </BitCard>
   );
}
