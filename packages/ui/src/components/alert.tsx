import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '#lib/utils';
import { withoutRef } from '#lib/preact-compat';

const alertVariants = cva('grid gap-1 rounded-lg border px-3 py-2 text-xs', {
   variants: {
      variant: {
         default: 'bg-card text-card-foreground',
         destructive: 'border-destructive/40 bg-destructive/10 text-destructive',
         info: 'border-border bg-muted text-foreground',
      },
   },
   defaultVariants: { variant: 'default' },
});

function Alert({
   className,
   variant = 'default',
   ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
   return (
      <div
         data-slot='alert'
         role='alert'
         className={cn(alertVariants({ variant }), className)}
         {...withoutRef(props)}
      />
   );
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
   return (
      <div
         data-slot='alert-title'
         className={cn('font-medium', className)}
         {...withoutRef(props)}
      />
   );
}

function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
   return (
      <div
         data-slot='alert-description'
         className={cn('text-muted-foreground', className)}
         {...withoutRef(props)}
      />
   );
}

export { Alert, AlertTitle, AlertDescription };
