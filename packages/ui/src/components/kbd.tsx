import * as React from 'react';

import { cn } from '#lib/utils';
import { withoutRef } from '#lib/preact-compat';

/** A keyboard-key hint. */
function Kbd({ className, ...props }: React.ComponentProps<'kbd'>) {
   return (
      <kbd
         data-slot='kbd'
         className={cn(
            'pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1 rounded-sm bg-muted px-1 font-sans text-[0.625rem] font-medium text-muted-foreground select-none',
            className,
         )}
         {...withoutRef(props)}
      />
   );
}

export { Kbd };
