import * as React from 'react';

import { cn } from '#lib/utils';
import { withoutRef } from '#lib/preact-compat';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
   return (
      <input
         type={type}
         data-slot='input'
         className={cn(
            'h-8 w-full min-w-0 rounded-md border border-input bg-transparent px-2 py-1 text-xs outline-none transition-[color,box-shadow] selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
            className,
         )}
         {...withoutRef(props)}
      />
   );
}

export { Input };
