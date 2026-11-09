// Adapted from 8bitcn/ui (MIT): https://www.8bitcn.com/
import type { ComponentProps } from 'react';
import { Button } from '#components/button';
import { Card } from '#components/card';
import { cn } from '#lib/utils';

type Font = 'retro' | 'normal';

export type BitButtonProps = ComponentProps<typeof Button> & { font?: Font };

function ButtonDecorations({
   size,
   variant,
}: {
   size: BitButtonProps['size'];
   variant: BitButtonProps['variant'];
}) {
   return (
      <span
         aria-hidden='true'
         className='pointer-events-none contents'
         data-slot='button-decorations'
      >
         {variant !== 'ghost' && variant !== 'link' && size !== 'icon' && (
            <>
               <span className='absolute -top-1.5 left-1.5 h-1.5 w-1/2 bg-foreground dark:bg-ring' />
               <span className='absolute -top-1.5 right-1.5 h-1.5 w-1/2 bg-foreground dark:bg-ring' />
               <span className='absolute -bottom-1.5 left-1.5 h-1.5 w-1/2 bg-foreground dark:bg-ring' />
               <span className='absolute -bottom-1.5 right-1.5 h-1.5 w-1/2 bg-foreground dark:bg-ring' />
               <span className='absolute top-0 left-0 size-1.5 bg-foreground dark:bg-ring' />
               <span className='absolute top-0 right-0 size-1.5 bg-foreground dark:bg-ring' />
               <span className='absolute bottom-0 left-0 size-1.5 bg-foreground dark:bg-ring' />
               <span className='absolute right-0 bottom-0 size-1.5 bg-foreground dark:bg-ring' />
               <span className='absolute top-1.5 -left-1.5 h-[calc(100%-12px)] w-1.5 bg-foreground dark:bg-ring' />
               <span className='absolute top-1.5 -right-1.5 h-[calc(100%-12px)] w-1.5 bg-foreground dark:bg-ring' />
               {variant !== 'outline' && (
                  <>
                     <span className='absolute top-0 left-0 h-1.5 w-full bg-foreground/20' />
                     <span className='absolute top-1.5 left-0 h-1.5 w-3 bg-foreground/20' />
                     <span className='absolute bottom-0 left-0 h-1.5 w-full bg-foreground/20' />
                     <span className='absolute right-0 bottom-1.5 h-1.5 w-3 bg-foreground/20' />
                  </>
               )}
            </>
         )}
      </span>
   );
}

/** 8bitcn-style button: pixel border decorations around the app Button. */
export function BitButton({
   className,
   font = 'retro',
   size = 'default',
   variant = 'default',
   children,
   ...props
}: BitButtonProps) {
   return (
      <Button
         {...props}
         size={size}
         variant={variant}
         className={cn(
            'relative inline-flex h-auto min-h-7 items-center justify-center gap-1.5 rounded-none border-none py-1 transition-transform active:translate-y-1',
            font !== 'normal' && 'retro',
            className,
         )}
      >
         {children}
         <ButtonDecorations
            size={size}
            variant={variant}
         />
      </Button>
   );
}

export type BitCardProps = ComponentProps<typeof Card> & { font?: Font };

/** 8bitcn-style card wrapper with the chunky pixelated border. */
export function BitCard({ className, font = 'retro', children, ...props }: BitCardProps) {
   return (
      <div className={cn('relative border-y-6 border-foreground bg-card p-0', className)}>
         <Card
            {...props}
            className={cn(
               'flex h-full w-full flex-col overflow-visible rounded-none border-0 bg-card text-card-foreground shadow-none',
               font !== 'normal' && 'retro',
            )}
         >
            {children}
         </Card>
         <div
            aria-hidden='true'
            className='pointer-events-none absolute inset-0 -mx-1.5 border-x-6 border-inherit'
         />
      </div>
   );
}

export type BitProgressProps = {
   value?: number;
   max?: number;
   className?: string;
   progressBg?: string;
   variant?: 'retro' | 'default';
   font?: Font;
};

/** Segmented retro progress bar. */
export function BitProgress({
   value = 0,
   max = 100,
   className,
   progressBg = 'bg-primary',
   variant = 'retro',
   font = 'retro',
}: BitProgressProps) {
   const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;

   return (
      <div className={cn('relative h-4 w-full', className)}>
         <div
            className={cn(
               'relative h-full w-full overflow-hidden bg-primary/20',
               font !== 'normal' && 'retro',
            )}
            role='progressbar'
            aria-valuenow={value}
            aria-valuemax={max}
         >
            {variant === 'retro' ? (
               <div className='flex h-full w-full'>
                  {Array.from({ length: 20 }, (_, index) => (
                     <div
                        key={index}
                        className={cn(
                           'mx-px h-full flex-1',
                           index < Math.round(percent / 5) ? progressBg : 'bg-transparent',
                        )}
                     />
                  ))}
               </div>
            ) : (
               <div
                  className={cn('h-full transition-all', progressBg)}
                  style={{ width: `${percent}%` }}
               />
            )}
         </div>
         <div
            aria-hidden='true'
            className='pointer-events-none absolute inset-0 -my-1 border-y-4 border-foreground dark:border-ring'
         />
         <div
            aria-hidden='true'
            className='pointer-events-none absolute inset-0 -mx-1 border-x-4 border-foreground dark:border-ring'
         />
      </div>
   );
}

export function HealthBar({
   value,
   className,
   color = 'bg-red-500',
}: {
   value: number;
   className?: string;
   color?: string;
}) {
   return (
      <BitProgress
         value={value}
         className={className}
         progressBg={color}
      />
   );
}

export function EnemyHealthDisplay({
   enemyName,
   level,
   currentHealth,
   maxHealth,
   showLevel = true,
   showHealthText = true,
   healthBarColor = 'bg-red-500',
   className,
}: {
   enemyName: string;
   level?: number;
   currentHealth: number;
   maxHealth: number;
   showLevel?: boolean;
   showHealthText?: boolean;
   healthBarColor?: string;
   className?: string;
}) {
   const percent =
      maxHealth > 0 ? Math.max(0, Math.min(100, (currentHealth / maxHealth) * 100)) : 0;

   return (
      <div className={cn('retro w-full space-y-2', className)}>
         <div className='flex items-center justify-between gap-2 text-[10px]'>
            <div className='flex min-w-0 items-center gap-2'>
               <span className='truncate font-bold'>{enemyName}</span>
               {showLevel && level ? (
                  <span className='text-muted-foreground'>Lv.{level}</span>
               ) : null}
            </div>
            {showHealthText ? (
               <span className='shrink-0 text-muted-foreground'>
                  {currentHealth}/{maxHealth}
               </span>
            ) : null}
         </div>
         <div className='relative'>
            <HealthBar
               value={percent}
               color={healthBarColor}
            />
            <div className='pointer-events-none absolute inset-0 flex items-center justify-center'>
               <span className='bg-black/60 px-1 text-[10px] font-bold text-white'>
                  {Math.round(percent)}%
               </span>
            </div>
         </div>
      </div>
   );
}
