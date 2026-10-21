import * as React from 'react';

import { cn } from '#lib/utils';
import { withoutRef } from '#lib/preact-compat';

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
   return (
      <div
         data-slot='skeleton'
         className={cn('animate-pulse rounded-md bg-muted', className)}
         {...withoutRef(props)}
      />
   );
}

export { Skeleton };
