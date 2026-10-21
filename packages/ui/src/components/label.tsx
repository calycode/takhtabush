import * as React from 'react';

import { cn } from '#lib/utils';
import { withoutRef } from '#lib/preact-compat';

function Label({ className, ...props }: React.ComponentProps<'label'>) {
   return (
      <label
         data-slot='label'
         className={cn(
            'flex items-center gap-1 text-xs font-medium select-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
            className,
         )}
         {...withoutRef(props)}
      />
   );
}

export { Label };
