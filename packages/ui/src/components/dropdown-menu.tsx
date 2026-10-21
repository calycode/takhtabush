import type { ComponentChildren } from 'preact';

import { cn } from '#lib/utils';

/**
 * Small native `<details>`-based menu (with submenus). Used instead of Base
 * UI's DropdownMenu so it behaves under `preact/compat` (SPEC §10.2).
 */
function closeRootMenu(element: HTMLElement) {
   const root = element.closest('details[data-slot="dropdown-menu"]');
   if (root) root.removeAttribute('open');
   const sub = element.closest('details[data-slot="dropdown-menu-sub"]');
   if (sub) sub.removeAttribute('open');
}

function DropdownMenu({
   className,
   children,
}: {
   className?: string;
   children: ComponentChildren;
}) {
   return (
      <details
         data-slot='dropdown-menu'
         className={cn('relative inline-block', className)}
      >
         {children}
      </details>
   );
}

function DropdownMenuTrigger({
   className,
   children,
}: {
   className?: string;
   children: ComponentChildren;
}) {
   return (
      <summary
         data-slot='dropdown-menu-trigger'
         className={cn(
            'inline-flex cursor-pointer list-none items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted [&::-webkit-details-marker]:hidden',
            className,
         )}
      >
         {children}
      </summary>
   );
}

function DropdownMenuContent({
   className,
   children,
}: {
   className?: string;
   children: ComponentChildren;
}) {
   return (
      <div
         data-slot='dropdown-menu-content'
         className={cn(
            'absolute right-0 z-50 mt-1 min-w-40 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md',
            className,
         )}
      >
         {children}
      </div>
   );
}

function DropdownMenuItem({
   onSelect,
   className,
   children,
}: {
   onSelect?: () => void;
   className?: string;
   children: ComponentChildren;
}) {
   return (
      <button
         type='button'
         data-slot='dropdown-menu-item'
         onClick={(event) => {
            onSelect?.();
            closeRootMenu(event.currentTarget);
         }}
         className={cn(
            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted [&_svg]:size-4 [&_svg]:shrink-0',
            className,
         )}
      >
         {children}
      </button>
   );
}

function DropdownMenuLabel({
   className,
   children,
}: {
   className?: string;
   children: ComponentChildren;
}) {
   return (
      <div
         data-slot='dropdown-menu-label'
         className={cn('px-2 py-1.5 text-xs font-medium', className)}
      >
         {children}
      </div>
   );
}

function DropdownMenuGroup({ children }: { children: ComponentChildren }) {
   return (
      <div
         data-slot='dropdown-menu-group'
         className='flex flex-col gap-0.5 py-0.5'
      >
         {children}
      </div>
   );
}

function DropdownMenuSeparator({ className }: { className?: string }) {
   return (
      <div
         data-slot='dropdown-menu-separator'
         role='separator'
         className={cn('-mx-1 my-1 h-px bg-border', className)}
      />
   );
}

function DropdownMenuSub({ children }: { children: ComponentChildren }) {
   return (
      <details
         data-slot='dropdown-menu-sub'
         className='relative'
      >
         {children}
      </details>
   );
}

function DropdownMenuSubTrigger({
   className,
   children,
}: {
   className?: string;
   children: ComponentChildren;
}) {
   return (
      <summary
         data-slot='dropdown-menu-sub-trigger'
         className={cn(
            'flex cursor-pointer list-none items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted [&::-webkit-details-marker]:hidden',
            className,
         )}
      >
         {children}
         <span className='text-muted-foreground'>›</span>
      </summary>
   );
}

function DropdownMenuSubContent({ children }: { children: ComponentChildren }) {
   return (
      <div
         data-slot='dropdown-menu-sub-content'
         className='absolute right-full top-0 z-50 mr-1 min-w-32 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md'
      >
         {children}
      </div>
   );
}

export {
   DropdownMenu,
   DropdownMenuTrigger,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuLabel,
   DropdownMenuGroup,
   DropdownMenuSeparator,
   DropdownMenuSub,
   DropdownMenuSubTrigger,
   DropdownMenuSubContent,
};
