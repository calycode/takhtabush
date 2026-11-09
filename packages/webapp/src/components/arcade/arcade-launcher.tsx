import { useState } from 'react';
import { useLocation } from 'preact-iso';
import { Gamepad2Icon, SkullIcon } from 'lucide-react';
import { Button } from '@caly/ui/components/button';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@caly/ui/components/card';
import { Card } from '@caly/ui/components/card';
import { BitButton } from '@caly/ui/arcade';
import type { GameMode } from '@caly/shared';
import { ApiError } from '../../lib/api/client';
import { startSession } from '../../lib/api/study';
import { ArcadeCabinet } from './arcade-cabinet';

const MODES: Array<{
   mode: GameMode;
   title: string;
   description: string;
   icon: typeof Gamepad2Icon;
   accent: string;
}> = [
   {
      mode: 'survival',
      title: 'SURVIVAL',
      description: '3 lives. Clear the queue. Misses cost a heart.',
      icon: Gamepad2Icon,
      accent: 'border-emerald-400 text-emerald-300',
   },
   {
      mode: 'boss',
      title: 'BOSS FIGHT',
      description: 'Weak cards become bosses. Chip their HP to win.',
      icon: SkullIcon,
      accent: 'border-red-500 text-red-300',
   },
];

/**
 * Opt-in arcade entry. The regular page stays regular; the cabinet only opens
 * when the user chooses to enter, and can be minimized into a handheld.
 */
export function ArcadeLauncher({
   deckId,
   deckTitle,
   cardCount,
}: {
   deckId: string;
   deckTitle: string;
   cardCount: number;
}) {
   const { route } = useLocation();
   const [open, setOpen] = useState(false);
   const [mode, setMode] = useState<GameMode>('survival');
   const [busy, setBusy] = useState(false);
   const [error, setError] = useState<string | null>(null);

   if (cardCount < 4) return null;

   async function start() {
      setBusy(true);
      setError(null);
      try {
         const result = await startSession({
            deckId,
            game: mode,
            mode: 'multiple_choice',
            goal: mode === 'boss' ? 'diagnose' : 'cram',
            minutes: 10,
         });
         route(`/study/${result.data.session.id}`);
      } catch (cause) {
         setError(cause instanceof ApiError ? cause.message : 'Could not start the arcade session');
         setBusy(false);
      }
   }

   if (!open) {
      return (
         <Card>
            <CardHeader>
               <CardTitle className='flex items-center gap-2'>
                  <Gamepad2Icon className='size-4' />
                  Arcade
               </CardTitle>
               <CardDescription>
                  A short survival run or a boss fight against your weakest cards.
               </CardDescription>
            </CardHeader>
            <CardContent>
               <Button
                  variant='outline'
                  onClick={() => setOpen(true)}
               >
                  <Gamepad2Icon />
                  Enter arcade
               </Button>
            </CardContent>
         </Card>
      );
   }

   const selected = MODES.find((item) => item.mode === mode) ?? MODES[0]!;

   return (
      <ArcadeCabinet
         statusLabel={mode === 'survival' ? 'SURVIVAL · 3 LIVES' : 'BOSS FIGHT · WEAK CARDS'}
         statusDetail={`${deckTitle} · ${cardCount} cards`}
         onClose={() => setOpen(false)}
      >
         <div className='flex flex-col gap-4 text-foreground'>
            <div className='text-center'>
               <div className='retro text-[10px] tracking-[0.18em] text-amber-300'>SELECT GAME</div>
               <p className='mx-auto mt-2 max-w-sm text-xs text-muted-foreground'>
                  Arcade answers still feed the normal scheduler. Play for a few minutes, then get
                  back to the deck.
               </p>
            </div>

            <div className='grid gap-3 sm:grid-cols-2'>
               {MODES.map((item) => {
                  const Icon = item.icon;
                  const active = mode === item.mode;
                  return (
                     <button
                        key={item.mode}
                        type='button'
                        onClick={() => setMode(item.mode)}
                        className={`flex flex-col gap-2 border-4 p-3 text-left transition-transform active:translate-y-1 ${
                           active
                              ? `bg-[#13251a] ${item.accent}`
                              : 'border-foreground/30 bg-[#0b1118] text-muted-foreground hover:border-foreground/60'
                        }`}
                     >
                        <span className='flex items-center gap-2'>
                           <Icon className='size-5' />
                           <span className='retro text-[10px]'>{item.title}</span>
                        </span>
                        <span className='text-[11px] leading-relaxed'>{item.description}</span>
                     </button>
                  );
               })}
            </div>

            {error && (
               <p className='border-2 border-red-500 bg-red-950/40 p-2 text-center text-xs text-red-300'>
                  {error}
               </p>
            )}

            <BitButton
               className='min-h-12 w-full bg-emerald-600 px-4 text-white'
               disabled={busy}
               onClick={() => void start()}
            >
               <Gamepad2Icon className='size-4' />
               {busy ? 'LOADING…' : 'INSERT COIN · START'}
            </BitButton>

            <div className='retro flex flex-wrap justify-center gap-x-4 gap-y-1 text-center text-[7px] text-muted-foreground'>
               <span>{selected.mode === 'survival' ? '3 LIVES' : 'BOSS HP 3–6'}</span>
               <span>REVIEWS STILL COUNT</span>
               <span>MINIMIZE ANYTIME</span>
            </div>
         </div>
      </ArcadeCabinet>
   );
}
