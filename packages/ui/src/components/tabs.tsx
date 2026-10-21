import { createContext, useContext } from 'react';
import type { ComponentChildren } from 'preact';

import { cn } from '#lib/utils';

const TabsContext = createContext<{ value: string; onChange: (value: string) => void }>({
   value: '',
   onChange: () => undefined,
});

function Tabs({
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
      <TabsContext.Provider value={{ value, onChange: onValueChange }}>
         <div
            data-slot='tabs'
            className={cn('flex flex-col gap-3', className)}
         >
            {children}
         </div>
      </TabsContext.Provider>
   );
}

function TabsList({ className, children }: { className?: string; children: ComponentChildren }) {
   return (
      <div
         data-slot='tabs-list'
         role='tablist'
         className={cn('inline-flex items-center gap-1 rounded-lg bg-muted p-1', className)}
      >
         {children}
      </div>
   );
}

function TabsTrigger({ value, children }: { value: string; children: ComponentChildren }) {
   const { value: active, onChange } = useContext(TabsContext);
   const selected = active === value;
   return (
      <button
         type='button'
         role='tab'
         aria-selected={selected}
         data-slot='tabs-trigger'
         onClick={() => onChange(value)}
         className={cn(
            'inline-flex items-center justify-center rounded-md px-2 py-1 text-xs font-medium transition-colors',
            selected
               ? 'bg-background text-foreground shadow-sm'
               : 'text-muted-foreground hover:text-foreground',
         )}
      >
         {children}
      </button>
   );
}

function TabsContent({
   value,
   className,
   children,
}: {
   value: string;
   className?: string;
   children: ComponentChildren;
}) {
   const { value: active } = useContext(TabsContext);
   if (active !== value) return null;
   return (
      <div
         data-slot='tabs-content'
         className={cn('outline-none', className)}
      >
         {children}
      </div>
   );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
