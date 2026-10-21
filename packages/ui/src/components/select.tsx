import { Select as SelectPrimitive } from '@base-ui/react/select';
import { CheckIcon, ChevronDownIcon } from 'lucide-react';

import { cn } from '#lib/utils';

export type SelectItem = { value: string; label: string };

/**
 * Base UI Select wrapper. Unlike a native `<select>`, the popup follows the
 * app's light/dark tokens (SPEC §10.2).
 */
function Select({
   value,
   onValueChange,
   items,
   id,
   className,
   placeholder = 'Select…',
   disabled,
}: {
   value: string;
   onValueChange: (value: string) => void;
   items: SelectItem[];
   id?: string;
   className?: string;
   placeholder?: string;
   disabled?: boolean;
}) {
   const selected = items.find((item) => item.value === value)?.label ?? placeholder;

   return (
      <SelectPrimitive.Root
         value={value}
         onValueChange={(next) => onValueChange(next as string)}
         disabled={disabled}
      >
         <SelectPrimitive.Trigger
            id={id}
            className={cn(
               'flex h-8 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 data-popup-open:ring-2',
               className,
            )}
         >
            <span className='truncate'>{selected}</span>
            <SelectPrimitive.Icon className='shrink-0 text-muted-foreground'>
               <ChevronDownIcon className='size-3.5' />
            </SelectPrimitive.Icon>
         </SelectPrimitive.Trigger>
         <SelectPrimitive.Portal>
            <SelectPrimitive.Positioner
               sideOffset={4}
               className='z-50'
            >
               <SelectPrimitive.Popup className='max-h-64 min-w-[var(--anchor-width)] overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-md'>
                  {items.map((item) => (
                     <SelectPrimitive.Item
                        key={item.value}
                        value={item.value}
                        className='flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1 text-xs outline-none select-none data-highlighted:bg-muted'
                     >
                        <SelectPrimitive.ItemText>{item.label}</SelectPrimitive.ItemText>
                        <SelectPrimitive.ItemIndicator className='text-primary'>
                           <CheckIcon className='size-3.5' />
                        </SelectPrimitive.ItemIndicator>
                     </SelectPrimitive.Item>
                  ))}
               </SelectPrimitive.Popup>
            </SelectPrimitive.Positioner>
         </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
   );
}

export { Select };
