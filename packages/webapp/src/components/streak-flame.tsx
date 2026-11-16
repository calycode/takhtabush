import type { CSSProperties } from 'react';
import { FlameIcon } from 'lucide-react';
import { cn } from '@caly/ui/lib/utils';

/** Tie the flicker speed and glow to how long the streak has survived. */
const TIERS = [
   { speed: 3.4, glow: 0, scale: 1 },
   { speed: 3, glow: 0.16, scale: 1.02 },
   { speed: 2.5, glow: 0.28, scale: 1.04 },
   { speed: 2, glow: 0.42, scale: 1.07 },
   { speed: 1.5, glow: 0.6, scale: 1.1 },
   { speed: 1.1, glow: 0.8, scale: 1.14 },
] as const;

function tierFor(days: number): number {
   if (days >= 30) return 5;
   if (days >= 14) return 4;
   if (days >= 7) return 3;
   if (days >= 3) return 2;
   if (days >= 1) return 1;
   return 0;
}

/**
 * Compact streak indicator: a flame plus the consecutive-day count.
 * The flame flickers faster and glows brighter as the streak grows, so a
 * month-long streak reads visibly hotter than a one-day one.
 */
export function StreakFlame({ days, className }: { days: number; className?: string }) {
   const active = days > 0;
   const tier = tierFor(days);
   const { speed, glow, scale } = TIERS[tier]!;
   const style = {
      '--streak-speed': `${speed}s`,
      '--streak-glow': glow,
      '--streak-scale': scale,
   } as CSSProperties;
   const color = !active
      ? 'text-muted-foreground'
      : tier >= 5
        ? 'fill-red-500/30 text-red-500'
        : tier >= 4
          ? 'fill-orange-500/30 text-orange-500'
          : tier >= 2
            ? 'fill-amber-500/30 text-amber-500'
            : 'fill-amber-400/20 text-amber-400';

   return (
      <span
         className={cn('inline-flex items-center gap-1.5', className)}
         style={style}
      >
         <span
            aria-hidden
            className={cn('streak-flame', active && 'streak-flame--active')}
         >
            <span className='streak-flame__glow' />
            <FlameIcon
               className={cn(
                  'streak-flame__icon size-5 shrink-0 transition-colors',
                  active ? color : 'text-muted-foreground',
               )}
            />
         </span>
         <span className='font-heading text-lg font-semibold tabular-nums'>{days}</span>
         <span className='text-xs text-muted-foreground'>day streak</span>
      </span>
   );
}
