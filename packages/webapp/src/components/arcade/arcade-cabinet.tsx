import { useState } from 'react';
import type { ComponentChildren } from 'preact';
import { Gamepad2Icon, MinusIcon, XIcon } from 'lucide-react';

const STORAGE_KEY = 'takhtabush:arcadeMinimized';

function readMinimized(): boolean {
   try {
      return localStorage.getItem(STORAGE_KEY) === '1';
   } catch {
      return false;
   }
}

function storeMinimized(value: boolean): void {
   try {
      localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
   } catch {
      // The in-memory state still works when storage is unavailable.
   }
}

/**
 * The arcade "fun island": a pixel cabinet around the game, collapsible into a
 * handheld phone. The app around it keeps its normal visual language.
 */
export function ArcadeCabinet({
   children,
   statusLabel,
   statusDetail,
   onClose,
}: {
   children: ComponentChildren;
   statusLabel?: string;
   statusDetail?: string;
   onClose?: () => void;
}) {
   const [minimized, setMinimized] = useState(readMinimized);

   function toggleMinimized(value: boolean) {
      setMinimized(value);
      storeMinimized(value);
   }

   if (minimized) {
      return (
         <div className='mx-auto flex w-full max-w-[680px] flex-col items-center gap-2 py-2'>
            <button
               type='button'
               onClick={() => toggleMinimized(false)}
               aria-label='Expand arcade'
               className='dark flex w-40 flex-col items-center gap-1.5 rounded-[22px] border-[6px] border-foreground bg-[#1a2430] p-2 text-left shadow-xl transition-transform hover:-translate-y-1'
            >
               <span className='retro w-full text-center text-[6px] tracking-widest text-amber-300'>
                  ARCADE
               </span>
               <span className='grid h-16 w-full place-items-center rounded-md border-4 border-foreground bg-[#05080c] text-emerald-400'>
                  <Gamepad2Icon className='size-7' />
               </span>
               <span className='flex w-full items-center justify-between px-1'>
                  <span className='size-3 rounded-full border-2 border-foreground bg-red-500' />
                  <span className='size-3 rounded-full border-2 border-foreground bg-amber-400' />
               </span>
               {statusDetail && (
                  <span className='retro w-full truncate text-center text-[6px] text-muted-foreground'>
                     {statusDetail}
                  </span>
               )}
            </button>
            <span className='text-[11px] text-muted-foreground'>Tap the handheld to expand</span>
         </div>
      );
   }

   return (
      <div className='dark relative mx-auto w-full max-w-[680px] transition-transform lg:rotate-[-1.2deg]'>
         <div className='relative rounded-[34px] border-[10px] border-foreground bg-[#0d141c] p-3 shadow-[0_34px_90px_-24px_rgba(0,0,0,0.8)] sm:p-4'>
            <div className='relative overflow-hidden rounded-[22px] border-4 border-foreground bg-[#151f2b] px-4 py-3'>
               <div
                  aria-hidden='true'
                  className='pointer-events-none absolute inset-0 opacity-20 [background:repeating-linear-gradient(90deg,transparent_0,transparent_10px,rgba(255,255,255,0.08)_10px,rgba(255,255,255,0.08)_12px)]'
               />
               <div className='relative flex items-center justify-between gap-3'>
                  <div className='min-w-0'>
                     <div className='retro text-[10px] tracking-[0.18em] text-amber-300'>
                        TAKHTABUSH ARCADE
                     </div>
                     <div className='retro mt-1 truncate text-[7px] text-emerald-300'>
                        {statusLabel ?? 'READY PLAYER ONE'}
                     </div>
                  </div>
                  <div className='flex shrink-0 gap-1'>
                     <button
                        type='button'
                        onClick={() => toggleMinimized(true)}
                        aria-label='Minimize arcade'
                        className='grid size-7 place-items-center border-2 border-foreground bg-[#0d141c] text-foreground hover:bg-[#223041]'
                     >
                        <MinusIcon className='size-3.5' />
                     </button>
                     {onClose && (
                        <button
                           type='button'
                           onClick={onClose}
                           aria-label='Close arcade'
                           className='grid size-7 place-items-center border-2 border-foreground bg-[#0d141c] text-foreground hover:bg-red-700 hover:text-white'
                        >
                           <XIcon className='size-3.5' />
                        </button>
                     )}
                  </div>
               </div>
            </div>

            <div className='relative mt-3 rounded-[22px] border-[10px] border-foreground bg-[#05080c] p-2 shadow-[inset_0_0_70px_rgba(34,197,94,0.16)]'>
               <div className='arcade-screen max-h-[64vh] overflow-y-auto rounded-[10px] bg-[#060a0f] p-3 sm:p-4'>
                  {children}
               </div>
               <div
                  aria-hidden='true'
                  className='pointer-events-none absolute inset-0 rounded-[10px] opacity-40 [background:repeating-linear-gradient(0deg,rgba(255,255,255,0.04)_0,rgba(255,255,255,0.04)_1px,transparent_1px,transparent_4px)]'
               />
            </div>

            <div className='mt-3 flex items-center justify-between gap-4 rounded-[22px] border-[10px] border-foreground bg-[#18222e] px-4 py-3'>
               <div className='flex items-end gap-3'>
                  <svg
                     width='64'
                     height='56'
                     viewBox='0 0 64 56'
                     aria-hidden='true'
                     className='text-foreground'
                  >
                     <ellipse
                        cx='32'
                        cy='50'
                        rx='22'
                        ry='6'
                        fill='#0b0f14'
                        stroke='currentColor'
                        strokeWidth='3'
                     />
                     <rect
                        x='28'
                        y='18'
                        width='8'
                        height='30'
                        fill='#93a4b8'
                        stroke='currentColor'
                        strokeWidth='3'
                     />
                     <circle
                        cx='32'
                        cy='14'
                        r='10'
                        fill='#ef4444'
                        stroke='currentColor'
                        strokeWidth='3'
                     />
                     <circle
                        cx='28'
                        cy='10'
                        r='3'
                        fill='#fecaca'
                     />
                  </svg>
                  <div className='flex gap-2'>
                     <span className='size-9 rounded-full border-4 border-foreground bg-red-600 shadow-inner' />
                     <span className='size-9 rounded-full border-4 border-foreground bg-amber-400 shadow-inner' />
                     <span className='size-9 rounded-full border-4 border-foreground bg-sky-500 shadow-inner' />
                  </div>
               </div>
               <div className='retro text-right text-[7px] text-muted-foreground'>
                  <div>1P ONLY</div>
                  <div className='mt-1 text-amber-300'>INSERT COIN</div>
               </div>
            </div>
         </div>
      </div>
   );
}
