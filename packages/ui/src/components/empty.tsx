import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '#lib/utils';
import { withoutRef } from '#lib/preact-compat';

function Empty({ className, ...props }: React.ComponentProps<'div'>) {
   return (
      <div
         data-slot='empty'
         className={cn(
            'flex w-full flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-10 text-center',
            className,
         )}
         {...withoutRef(props)}
      />
   );
}

function EmptyHeader({ className, ...props }: React.ComponentProps<'div'>) {
   return (
      <div
         data-slot='empty-header'
         className={cn('flex flex-col items-center gap-1', className)}
         {...withoutRef(props)}
      />
   );
}

const emptyMediaVariants = cva('flex items-center justify-center text-muted-foreground', {
   variants: {
      variant: {
         default: '',
         icon: 'size-10 rounded-full bg-muted [&_svg]:size-5',
      },
   },
   defaultVariants: { variant: 'default' },
});

function EmptyMedia({
   className,
   variant = 'default',
   ...props
}: React.ComponentProps<'div'> & VariantProps<typeof emptyMediaVariants>) {
   return (
      <div
         data-slot='empty-media'
         className={cn(emptyMediaVariants({ variant }), className)}
         {...withoutRef(props)}
      />
   );
}

function EmptyTitle({ className, ...props }: React.ComponentProps<'div'>) {
   return (
      <div
         data-slot='empty-title'
         className={cn('font-heading text-sm font-medium', className)}
         {...withoutRef(props)}
      />
   );
}

function EmptyDescription({ className, ...props }: React.ComponentProps<'p'>) {
   return (
      <p
         data-slot='empty-description'
         className={cn('max-w-sm text-xs/relaxed text-muted-foreground', className)}
         {...withoutRef(props)}
      />
   );
}

function EmptyContent({ className, ...props }: React.ComponentProps<'div'>) {
   return (
      <div
         data-slot='empty-content'
         className={cn('flex items-center gap-2', className)}
         {...withoutRef(props)}
      />
   );
}

export { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent };
