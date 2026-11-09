import { useCallback, useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import type { Achievement } from '@caly/shared';
import { BitButton, BitCard } from '@caly/ui/arcade';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@caly/ui/components/card';
import { getAchievements, markAchievementsSeen, shareAchievement } from '../lib/api/achievements';
import { ACHIEVEMENT_EVENT } from '../lib/achievements';
import { useAuth } from '../lib/auth';

const NETWORKS = {
   x: (text: string) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
   reddit: (text: string, url: string) =>
      `https://www.reddit.com/submit?title=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
   bluesky: (text: string) => `https://bsky.app/intent/compose?text=${encodeURIComponent(text)}`,
};

/**
 * Global achievement toast: confetti, the achievement, and share intents.
 * Pending achievements are fetched once per authenticated session; real-time
 * unlocks arrive through the `takhtabush:achievements` window event.
 */
export function AchievementCelebration() {
   const { status } = useAuth();
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

   function share(network: keyof typeof NETWORKS) {
      if (!current) return;
      const url = window.location.origin;
      const text = `${current.shareText} ${url}`;
      const target =
         network === 'reddit' ? NETWORKS.reddit(current.shareText, url) : NETWORKS[network](text);
      window.open(target, '_blank', 'noopener,noreferrer');
      void shareAchievement(current.id)
         .then((result) => enqueue(result.data.newAchievements))
         .catch(() => undefined);
   }

   async function copy() {
      if (!current) return;
      if (navigator.clipboard) {
         await navigator.clipboard
            .writeText(`${current.shareText} ${window.location.origin}`)
            .catch(() => undefined);
      }
      void shareAchievement(current.id)
         .then((result) => enqueue(result.data.newAchievements))
         .catch(() => undefined);
   }

   return (
      <div className='fixed inset-x-4 bottom-4 z-50 ml-auto w-auto max-w-sm sm:inset-x-auto sm:right-4'>
         <BitCard
            font='normal'
            className='bg-card shadow-2xl'
         >
            <CardHeader>
               <div className='flex items-start gap-3'>
                  <span
                     className='text-4xl'
                     aria-hidden='true'
                  >
                     {current.icon}
                  </span>
                  <div className='min-w-0'>
                     <CardDescription className='retro text-[8px] uppercase'>
                        Achievement unlocked
                     </CardDescription>
                     <CardTitle className='mt-1 text-base'>{current.title}</CardTitle>
                     <CardDescription className='mt-1'>{current.description}</CardDescription>
                  </div>
               </div>
            </CardHeader>
            <CardContent className='flex flex-col gap-3'>
               <p className='retro text-[8px] leading-relaxed text-muted-foreground'>
                  Brag about it?
               </p>
               <div className='flex flex-wrap gap-1.5'>
                  <BitButton
                     size='sm'
                     onClick={() => share('x')}
                  >
                     X
                  </BitButton>
                  <BitButton
                     size='sm'
                     variant='outline'
                     onClick={() => share('reddit')}
                  >
                     Reddit
                  </BitButton>
                  <BitButton
                     size='sm'
                     variant='outline'
                     onClick={() => share('bluesky')}
                  >
                     Bluesky
                  </BitButton>
                  <BitButton
                     size='sm'
                     variant='ghost'
                     onClick={() => void copy()}
                  >
                     Copy
                  </BitButton>
                  <BitButton
                     size='sm'
                     variant='ghost'
                     className='ml-auto'
                     onClick={dismiss}
                  >
                     Dismiss
                  </BitButton>
               </div>
            </CardContent>
         </BitCard>
      </div>
   );
}
