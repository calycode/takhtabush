import { useState } from 'react';
import { useLocation } from 'preact-iso';
import { Gamepad2Icon, SkullIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@caly/ui/components/alert';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@caly/ui/components/card';
import { BitButton, BitCard } from '@caly/ui/arcade';
import type { GameMode } from '@caly/shared';
import { ApiError } from '../../lib/api/client';
import { startSession } from '../../lib/api/study';

/**
 * Arcade entry point on the deck page. Games start a persisted session so a
 * refresh resumes the same run.
 */
export function ArcadeLauncher({ deckId, cardCount }: { deckId: string; cardCount: number }) {
   const { route } = useLocation();
   const [busy, setBusy] = useState<GameMode | null>(null);
   const [error, setError] = useState<string | null>(null);

   if (cardCount < 4) return null;

   async function start(kind: GameMode) {
      setBusy(kind);
      setError(null);
      try {
         const result = await startSession({
            deckId,
            game: kind,
            mode: 'multiple_choice',
            goal: kind === 'boss' ? 'diagnose' : 'cram',
            minutes: 10,
         });
         route(`/study/${result.data.session.id}`);
      } catch (cause) {
         setError(cause instanceof ApiError ? cause.message : 'Could not start the arcade session');
         setBusy(null);
      }
   }

   return (
      <BitCard className='bg-emerald-950/5 dark:bg-emerald-950/20'>
         <CardHeader>
            <CardTitle className='flex items-center gap-2 text-sm tracking-wide uppercase'>
               <Gamepad2Icon className='size-4' />
               Arcade
            </CardTitle>
            <CardDescription>
               Short, high-stakes runs. Reviews still feed the normal scheduler.
            </CardDescription>
         </CardHeader>
         <CardContent className='flex flex-col gap-3'>
            {error && (
               <Alert variant='destructive'>
                  <AlertDescription>{error}</AlertDescription>
               </Alert>
            )}
            <div className='flex flex-wrap gap-3'>
               <BitButton
                  className='min-h-10 bg-emerald-600 px-4 text-white'
                  disabled={busy !== null}
                  onClick={() => void start('survival')}
               >
                  <Gamepad2Icon className='size-4' />
                  {busy === 'survival' ? 'Loading…' : 'Survival'}
               </BitButton>
               <BitButton
                  className='min-h-10 bg-red-700 px-4 text-white'
                  disabled={busy !== null}
                  onClick={() => void start('boss')}
               >
                  <SkullIcon className='size-4' />
                  {busy === 'boss' ? 'Loading…' : 'Boss fight'}
               </BitButton>
            </div>
            <p className='retro text-[9px] leading-relaxed text-muted-foreground'>
               3 lives. Wrong answers cost one. Survival clears the queue; boss fight focuses your
               weakest cards.
            </p>
         </CardContent>
      </BitCard>
   );
}
