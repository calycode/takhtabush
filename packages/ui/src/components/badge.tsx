import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '#lib/utils';
import { withoutRef } from '#lib/preact-compat';

const badgeVariants = cva(
   'inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-[0.625rem] font-medium whitespace-nowrap',
   {
      variants: {
         variant: {
            default: 'bg-primary text-primary-foreground [a&]:hover:bg-primary/90',
            secondary: 'bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90',
            outline: 'border-border text-foreground [a&]:hover:bg-muted',
            destructive: 'bg-destructive/10 text-destructive',
         },
      },
      defaultVariants: { variant: 'default' },
   },
);

function Badge({
   className,
   variant = 'default',
   ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
   return (
      <span
         data-slot='badge'
         className={cn(badgeVariants({ variant }), className)}
         {...withoutRef(props)}
      />
   );
}

export { Badge, badgeVariants };
