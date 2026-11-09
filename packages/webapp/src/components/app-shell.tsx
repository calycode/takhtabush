import type { ComponentChildren } from 'preact';
import { AchievementCelebration } from './achievement-celebration';
import { AvatarMenu } from './avatar-menu';

export function AppShell({ children }: { children: ComponentChildren }) {
   return (
      <div className='min-h-dvh bg-background text-foreground'>
         <header className='sticky top-0 z-40 flex items-center justify-between gap-4 border-b bg-background/95 px-4 py-2 backdrop-blur'>
            <a
               href='/'
               className='inline-flex items-center'
            >
               <img
                  src='/logo-long.png'
                  alt='Takhtabush'
                  width='66'
                  height='32'
                  className='h-8 w-auto'
               />
            </a>
            <AvatarMenu />
         </header>
         <main className='mx-auto w-full max-w-5xl px-4 py-8'>{children}</main>
         <AchievementCelebration />
      </div>
   );
}
