import type { ComponentChildren } from 'preact';
import { AvatarMenu } from './avatar-menu';

export function AppShell({ children }: { children: ComponentChildren }) {
   return (
      <div className='min-h-dvh bg-background text-foreground'>
         <header className='sticky top-0 z-40 flex items-center justify-between gap-4 border-b bg-background/95 px-4 py-2 backdrop-blur'>
            <a
               href='/'
               className='inline-flex items-center gap-2 font-heading font-medium'
            >
               <img
                  src='/logo.png'
                  alt=''
                  width='28'
                  height='28'
                  className='rounded-[7px]'
               />
               Takhtabush
            </a>
            <AvatarMenu />
         </header>
         <main className='mx-auto w-full max-w-5xl px-4 py-8'>{children}</main>
      </div>
   );
}
