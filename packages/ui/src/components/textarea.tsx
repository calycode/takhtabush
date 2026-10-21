import * as React from 'react';

import { cn } from '#lib/utils';
import { withoutRef } from '#lib/preact-compat';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
   return (
      <textarea
         data-slot='textarea'
         className={cn(
            'flex min-h-16 w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50',
            className,
         )}
         {...withoutRef(props)}
      />
   );
}

export { Textarea };
