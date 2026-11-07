import { useMemo } from 'react';
import { cn } from '@caly/ui/lib/utils';

export type ActivityPoint = { date: string; count: number };

const DAY_MS = 86_400_000;

/** Intensity bucket (0 = no activity, 4 = busiest). */
function bucket(count: number): number {
   if (count === 0) return 0;
   if (count <= 2) return 1;
   if (count <= 5) return 2;
   if (count <= 10) return 3;
   return 4;
}

const CELL_STYLES = [
   'bg-muted',
   'bg-primary/25',
   'bg-primary/50',
   'bg-primary/75',
   'bg-primary',
] as const;

type Cell = { date: string; count: number; future: boolean };

function startOfTodayUtc(): Date {
   const today = new Date();
   today.setUTCHours(0, 0, 0, 0);
   return today;
}

/**
 * GitHub-style activity heatmap: a Sunday-aligned grid of the last `weeks`
 * weeks, coloured by daily review count. Sparse `points` are zero-filled and
 * future days are rendered blank so the grid visibly ends at today.
 */
export function ReviewHeatmap({
   points,
   weeks = 16,
   className,
}: {
   points: ActivityPoint[];
   weeks?: number;
   className?: string;
}) {
   const counts = useMemo(() => {
      const map = new Map<string, number>();
      for (const point of points) map.set(point.date, point.count);
      return map;
   }, [points]);

   const columns = useMemo(() => {
      const today = startOfTodayUtc();
      const endOfWeek = new Date(today.getTime() - today.getUTCDay() * DAY_MS); // Sunday
      const start = new Date(endOfWeek.getTime() - (weeks - 1) * 7 * DAY_MS);

      const cells: Cell[] = [];
      const cursor = new Date(start);
      for (let i = 0; i < weeks * 7; i++) {
         const date = cursor.toISOString().slice(0, 10);
         const future = cursor.getTime() > today.getTime();
         cells.push({ date, count: future ? 0 : (counts.get(date) ?? 0), future });
         cursor.setUTCDate(cursor.getUTCDate() + 1);
      }

      const grid: Cell[][] = [];
      for (let i = 0; i < cells.length; i += 7) grid.push(cells.slice(i, i + 7));
      return grid;
   }, [counts, weeks]);

   return (
      <div className={cn('overflow-x-auto pb-1', className)}>
         <div className='inline-grid grid-flow-col gap-1'>
            {columns.map((column, index) => (
               <div
                  key={index}
                  className='grid grid-rows-7 gap-1'
               >
                  {column.map((cell) => (
                     <span
                        key={cell.date}
                        title={
                           cell.future
                              ? cell.date
                              : `${cell.count} review${cell.count === 1 ? '' : 's'} on ${cell.date}`
                        }
                        aria-label={
                           cell.future
                              ? cell.date
                              : `${cell.count} review${cell.count === 1 ? '' : 's'} on ${cell.date}`
                        }
                        className={cn(
                           'size-3 rounded-sm',
                           cell.future ? 'bg-transparent' : CELL_STYLES[bucket(cell.count)],
                        )}
                     />
                  ))}
               </div>
            ))}
         </div>
      </div>
   );
}
