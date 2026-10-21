import * as React from 'react';

import { cn } from '#lib/utils';
import { withoutRef } from '#lib/preact-compat';

function Progress({
   className,
   value = 0,
   max = 100,
   ...props
}: React.ComponentProps<'div'> & { value?: number; max?: number }) {
   const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
   return (
      <div
         data-slot='progress'
         role='progressbar'
         aria-valuenow={value}
         aria-valuemax={max}
         className={cn('h-1.5 w-full overflow-hidden rounded-full bg-muted', className)}
         {...withoutRef(props)}
      >
         <div
            data-slot='progress-indicator'
            className='h-full bg-primary transition-all'
            style={{ width: `${percent}%` }}
         />
      </div>
   );
}

export { Progress };
