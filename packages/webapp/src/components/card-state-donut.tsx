import { useMemo } from 'react';
import type { DeckStats } from '@caly/shared';

type Segment = { label: string; value: number; color: string };

/**
 * Exclusive card-state buckets. `learningCards` includes due cards, so due is
 * split out before rendering. Suspended cards are counted separately.
 */
function segmentsFor(stats: DeckStats): Segment[] {
   const due = Math.min(stats.dueCards, stats.learningCards);
   return [
      { label: 'New', value: stats.newCards, color: 'var(--primary)' },
      {
         label: 'Learning',
         value: Math.max(0, stats.learningCards - due),
         color: '#38bdf8',
      },
      { label: 'Due now', value: due, color: '#f59e0b' },
      { label: 'Suspended', value: stats.suspendedCards, color: '#94a3b8' },
   ];
}

export function CardStateDonut({ stats }: { stats: DeckStats }) {
   const segments = useMemo(() => segmentsFor(stats), [stats]);
   const total = segments.reduce((sum, segment) => sum + segment.value, 0);

   if (total === 0) {
      return <p className='py-6 text-center text-sm text-muted-foreground'>No cards yet.</p>;
   }

   let cursor = 0;
   const stops = segments
      .filter((segment) => segment.value > 0)
      .map((segment) => {
         const start = cursor;
         cursor += (segment.value / total) * 100;
         return `${segment.color} ${start}% ${cursor}%`;
      });

   return (
      <div className='flex flex-wrap items-center justify-center gap-6 py-2'>
         <div
            className='relative grid size-36 shrink-0 place-items-center rounded-full'
            style={{ background: `conic-gradient(${stops.join(', ')})` }}
            role='img'
            aria-label='Card state distribution'
         >
            <div className='grid size-24 place-items-center rounded-full bg-card text-center shadow-inner'>
               <div>
                  <div className='font-heading text-2xl font-semibold tabular-nums'>{total}</div>
                  <div className='text-[10px] text-muted-foreground uppercase'>cards</div>
               </div>
            </div>
         </div>
         <ul className='grid min-w-40 gap-2 text-sm'>
            {segments.map((segment) => (
               <li
                  key={segment.label}
                  className='flex items-center gap-2'
               >
                  <span
                     className='size-2.5 rounded-sm'
                     style={{ backgroundColor: segment.color }}
                     aria-hidden='true'
                  />
                  <span className='flex-1 text-muted-foreground'>{segment.label}</span>
                  <span className='font-medium tabular-nums'>{segment.value}</span>
               </li>
            ))}
         </ul>
      </div>
   );
}
