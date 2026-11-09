import { useMemo } from 'react';
import type { DueForecastPoint } from '@caly/shared';

const DAY_MS = 86_400_000;

function dateKey(date: Date): string {
   return date.toISOString().slice(0, 10);
}

function shortDate(value: string): string {
   const [, month, day] = value.split('-');
   return `${month}/${day}`;
}

/** Next-N-days workload bars. Sparse points are zero-filled by date. */
export function DueForecastChart({
   points,
   days = 14,
}: {
   points: DueForecastPoint[];
   days?: number;
}) {
   const values = useMemo(() => {
      const counts = new Map(points.map((point) => [point.date, point.count]));
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const result: DueForecastPoint[] = [];
      for (let index = 0; index < days; index++) {
         const date = dateKey(new Date(today.getTime() + index * DAY_MS));
         result.push({ date, count: counts.get(date) ?? 0 });
      }
      return result;
   }, [points, days]);

   const max = Math.max(1, ...values.map((point) => point.count));
   const total = values.reduce((sum, point) => sum + point.count, 0);

   if (total === 0) {
      return (
         <p className='py-6 text-center text-sm text-muted-foreground'>
            Nothing scheduled in the next {days} days.
         </p>
      );
   }

   return (
      <div
         className='flex h-44 items-end gap-1.5'
         role='img'
         aria-label={`Due cards per day for the next ${days} days`}
      >
         {values.map((point) => {
            const height = point.count === 0 ? 2 : Math.max(6, (point.count / max) * 100);
            return (
               <div
                  key={point.date}
                  className='flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5'
                  title={`${point.count} due on ${point.date}`}
               >
                  <span className='text-[10px] font-medium tabular-nums text-muted-foreground'>
                     {point.count || ''}
                  </span>
                  <div className='flex w-full flex-1 items-end'>
                     <div
                        className={
                           point.count === 0
                              ? 'w-full rounded-t-sm bg-muted'
                              : 'w-full rounded-t-sm bg-primary/80 transition-[height] duration-300'
                        }
                        style={{ height: `${height}%` }}
                     />
                  </div>
                  <span className='text-[9px] whitespace-nowrap text-muted-foreground'>
                     {shortDate(point.date)}
                  </span>
               </div>
            );
         })}
      </div>
   );
}
