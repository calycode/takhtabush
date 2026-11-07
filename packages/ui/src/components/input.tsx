import * as React from 'react';

import { cn } from '#lib/utils';
import { withoutRef } from '#lib/preact-compat';

function Input({ className, type, role: _role, ...props }: React.ComponentProps<'input'>) {
   // Preact 11 types `<input>` as a discriminated union on `type`; a generic
   // wrapper accepts the broad type, so cast at the element boundary.
   const inputProps = {
      type,
      'data-slot': 'input',
      className: cn(
         'h-8 w-full min-w-0 rounded-md border border-input bg-transparent px-2 py-1 text-xs outline-none transition-[color,box-shadow] selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
         className,
      ),
      ...withoutRef(props),
   } as unknown as React.InputHTMLAttributes<HTMLInputElement>;

   return <input {...inputProps} />;
}

export { Input };
