import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import confetti from 'canvas-confetti';
import type { Achievement } from '@caly/shared';
import { BitButton, BitCard } from '@caly/ui/arcade';
import { Button } from '@caly/ui/components/button';
import {
   Card,
   CardContent,
   CardDescription,
   CardHeader,
   CardTitle,
} from '@caly/ui/components/card';
import { getAchievements, markAchievementsSeen } from '../lib/api/achievements';
import {
   copyAchievementShare,
   openAchievementShare,
   recordAchievementShare,
   type ShareNetwork,
} from '../lib/achievement-share';
import { announceAchievements, ACHIEVEMENT_EVENT } from '../lib/achievements';
import { useAuth } from '../lib/auth';
import { useRetroPreference } from '../lib/retro';
import { ShareGlyph } from './share-glyphs';

function AchievementAction({
   retro,
   children,
   ...props
}: ComponentProps<typeof Button> & { retro: boolean }) {
   return retro ? (
      <BitButton {...props}>{children}</BitButton>
   ) : (
      <Button {...props}>{children}</Button>
   );
}

const SHARE_NETWORKS: Array<{ network: ShareNetwork; label: string }> = [
   { network: 'x', label: 'x.com' },
   { network: 'reddit', label: 'Reddit' },
   { network: 'bluesky', label: 'Bluesky' },
];

/**
 * Global achievement toast: confetti, the achievement, and share intents.
 * Pending achievements are fetched once per authenticated session; real-time
 * unlocks arrive through the `takhtabush:achievements` window event.
 */
export function AchievementCelebration() {
   const { status } = useAuth();
   const { retro } = useRetroPreference();
   const [queue, setQueue] = useState<Achievement[]>([]);
   const shown = useRef(new Set<string>());

   const enqueue = useCallback((items: Achievement[]) => {
      if (items.length === 0) return;
      setQueue((current) => {
         const known = new Set([...current.map((item) => item.id), ...shown.current]);
         const next = items.filter((item) => !known.has(item.id));
         return next.length > 0 ? [...current, ...next] : current;
      });
   }, []);

   useEffect(() => {
      const onAchievement = (event: Event) => {
         const detail = (event as CustomEvent<Achievement[]>).detail;
         if (Array.isArray(detail)) enqueue(detail);
      };
      window.addEventListener(ACHIEVEMENT_EVENT, onAchievement);
      return () => window.removeEventListener(ACHIEVEMENT_EVENT, onAchievement);
   }, [enqueue]);

   useEffect(() => {
      if (status !== 'authenticated') return;
      let active = true;
      getAchievements()
         .then((result) => {
            if (active) enqueue(result.data.pending);
         })
         .catch(() => undefined);
      return () => {
         active = false;
      };
   }, [status, enqueue]);

   const current = queue[0] ?? null;

   useEffect(() => {
      if (!current) return;
      shown.current.add(current.id);
      confetti({
         particleCount: 120,
         spread: 75,
         origin: { y: 0.75 },
         disableForReducedMotion: true,
      });
      void markAchievementsSeen([current.id]).catch(() => undefined);
   }, [current?.id]);

   if (!current) return null;

   function dismiss() {
      setQueue((items) => items.slice(1));
   }

   function share(network: ShareNetwork) {
      if (!current) return;
      openAchievementShare(network, current);
      void recordAchievementShare(current)
         .then((items) => announceAchievements(items))
         .catch(() => undefined);
   }

   function copy() {
      if (!current) return;
      void copyAchievementShare(current);
      void recordAchievementShare(current)
         .then((items) => announceAchievements(items))
         .catch(() => undefined);
   }

   const body = (
      <>
         <CardHeader>
            <div className='flex items-start gap-3'>
               <span
                  className='text-4xl'
                  aria-hidden='true'
               >
                  {current.icon}
               </span>
               <div className='min-w-0'>
                  <CardDescription
                     className={retro ? 'retro text-[8px] uppercase' : 'text-[10px] uppercase'}
                  >
                     Achievement unlocked
                  </CardDescription>
                  <CardTitle className='mt-1 text-base'>{current.title}</CardTitle>
                  <CardDescription className='mt-1'>{current.description}</CardDescription>
               </div>
            </div>
         </CardHeader>
         <CardContent className='flex flex-col gap-3'>
            <p
               className={
                  retro
                     ? 'retro text-[8px] leading-relaxed text-muted-foreground'
                     : 'text-xs text-muted-foreground'
               }
            >
               Brag about it?
            </p>
            <div className='flex flex-wrap gap-5'>
               {SHARE_NETWORKS.map((item) => (
                  <AchievementAction
                     key={item.network}
                     retro={retro}
                     size='sm'
                     variant='outline'
                     onClick={() => share(item.network)}
                  >
                     <ShareGlyph network={item.network} />
                     {item.label}
                  </AchievementAction>
               ))}
               <AchievementAction
                  retro={retro}
                  size='sm'
                  variant='ghost'
                  onClick={copy}
               >
                  <ShareGlyph network='copy' />
                  Copy
               </AchievementAction>
               <AchievementAction
                  retro={retro}
                  size='sm'
                  variant='ghost'
                  className='ml-auto'
                  onClick={dismiss}
               >
                  Dismiss
               </AchievementAction>
            </div>
         </CardContent>
      </>
   );

   return (
      <div className='fixed inset-x-4 bottom-4 z-50 ml-auto w-auto max-w-sm sm:inset-x-auto sm:right-4'>
         {retro ? (
            <BitCard
               font='normal'
               className='bg-card shadow-2xl'
            >
               {body}
            </BitCard>
         ) : (
            <Card className='shadow-2xl'>{body}</Card>
         )}
      </div>
   );
}
