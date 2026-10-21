import { createContext, useContext } from 'react';
import type { ComponentChildren } from 'preact';

import { cn } from '#lib/utils';

const RadioGroupContext = createContext<{ value: string; onChange: (value: string) => void }>({
   value: '',
   onChange: () => undefined,
});

function RadioGroup({
   value,
   onValueChange,
   className,
   children,
}: {
   value: string;
   onValueChange: (value: string) => void;
   className?: string;
   children: ComponentChildren;
}) {
   return (
      <RadioGroupContext.Provider value={{ value, onChange: onValueChange }}>
         <div
            role='radiogroup'
            data-slot='radio-group'
            className={cn('grid gap-2', className)}
         >
            {children}
         </div>
      </RadioGroupContext.Provider>
   );
}

function RadioGroupItem({
   value,
   id,
   className,
}: {
   value: string;
   id?: string;
   className?: string;
}) {
   const context = useContext(RadioGroupContext);
   return (
      <input
         type='radio'
         id={id}
         name='radio-group'
         value={value}
         checked={context.value === value}
         onChange={() => context.onChange(value)}
         data-slot='radio-group-item'
         className={cn('size-3.5 accent-primary', className)}
      />
   );
}

export { RadioGroup, RadioGroupItem };
