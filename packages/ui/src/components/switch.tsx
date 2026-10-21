import { cn } from '#lib/utils';

function Switch({
   checked,
   onCheckedChange,
   className,
   disabled,
   id,
}: {
   checked: boolean;
   onCheckedChange: (checked: boolean) => void;
   className?: string;
   disabled?: boolean;
   id?: string;
}) {
   return (
      <button
         type='button'
         id={id}
         role='switch'
         aria-checked={checked}
         disabled={disabled}
         data-slot='switch'
         onClick={() => onCheckedChange(!checked)}
         className={cn(
            'inline-flex h-4 w-7 shrink-0 items-center rounded-full border border-transparent transition-colors focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50',
            checked ? 'bg-primary' : 'bg-input',
            className,
         )}
      >
         <span
            className={cn(
               'pointer-events-none block size-3 rounded-full bg-background shadow-sm transition-transform',
               checked ? 'translate-x-3.5' : 'translate-x-0.5',
            )}
         />
      </button>
   );
}

export { Switch };
