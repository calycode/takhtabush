import { FlameIcon } from 'lucide-react';
import { cn } from '@caly/ui/lib/utils';

/**
 * Compact streak indicator: a flame plus the consecutive-day count.
 * The flame renders in a warm accent when the streak is live, muted
 * when there is nothing to celebrate yet.
 */
export function StreakFlame({ days, className }: { days: number; className?: string }) {
   const active = days > 0;
   return (
      <span className={cn('inline-flex items-center gap-1.5', className)}>
         <FlameIcon
            aria-hidden
            className={cn(
               'size-5 shrink-0 transition-colors',
               active ? 'fill-amber-500/25 text-amber-500' : 'text-muted-foreground',
            )}
         />
         <span className='font-heading text-lg font-semibold tabular-nums'>{days}</span>
         <span className='text-xs text-muted-foreground'>day streak</span>
      </span>
   );
}
