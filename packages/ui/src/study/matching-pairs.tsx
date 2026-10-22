import { useMemo, useRef, useState } from 'react';
import type { StudyCardData } from '@caly/shared';
import { cardAnswer, seededShuffle } from '@caly/shared';

import { Button } from '#components/button';
import { Card as UICard, CardContent } from '#components/card';
import { cn } from '#lib/utils';

export type PairSignals = { attempts: number; durationMs: number };

/**
 * Two-column association over a batch of cards (SPEC §10.5). Shared by the web
 * app and the MCP Apps widget.
 */
export function MatchingPairs({
   cards,
   busy,
   onPair,
   onComplete,
}: {
   cards: StudyCardData[];
   busy: boolean;
   onPair: (card: StudyCardData, signals: PairSignals) => Promise<boolean> | void;
   onComplete?: () => void;
}) {
   const seed = cards.map((card) => card.id).join('|');
   const rightItems = useMemo(
      () =>
         seededShuffle(
            cards.map((card) => ({ id: card.id, label: cardAnswer(card) })),
            seed,
         ),
      [seed, cards],
   );

   const [selected, setSelected] = useState<string | null>(null);
   const [matched, setMatched] = useState<string[]>([]);
   const [wrong, setWrong] = useState<string | null>(null);
   const attempts = useRef<Record<string, number>>({});
   const startedAt = useRef<Record<string, number>>({});

   function selectLeft(id: string) {
      setSelected(id);
      if (!startedAt.current[id]) startedAt.current[id] = Date.now();
   }

   async function tryMatch(rightId: string) {
      if (!selected || busy || matched.includes(rightId)) return;
      if (selected === rightId) {
         const card = cards.find((item) => item.id === rightId);
         const result = card
            ? onPair(card, {
                 attempts: (attempts.current[card.id] ?? 0) + 1,
                 durationMs: Date.now() - (startedAt.current[card.id] ?? Date.now()),
              })
            : false;
         if (result instanceof Promise && !(await result)) return;
         const next = [...matched, rightId];
         setMatched(next);
         setSelected(null);
         if (next.length === cards.length) onComplete?.();
      } else {
         attempts.current[selected] = (attempts.current[selected] ?? 0) + 1;
         setWrong(rightId);
         window.setTimeout(() => setWrong(null), 400);
      }
   }

   return (
      <UICard>
         <CardContent className='grid grid-cols-2 gap-2 py-6 sm:gap-3'>
            <div className='flex min-w-0 flex-col gap-2'>
               {cards.map((card) => {
                  const done = matched.includes(card.id);
                  return (
                     <Button
                        key={card.id}
                        variant={selected === card.id ? 'default' : 'outline'}
                        disabled={done || busy}
                        className={cn(
                           'h-auto min-h-11 min-w-0 justify-start whitespace-normal px-2 py-2 text-left wrap-anywhere sm:px-3',
                           done && 'opacity-50',
                        )}
                        onClick={() => selectLeft(card.id)}
                     >
                        {card.front}
                     </Button>
                  );
               })}
            </div>
            <div className='flex min-w-0 flex-col gap-2'>
               {rightItems.map((item) => {
                  const done = matched.includes(item.id);
                  return (
                     <Button
                        key={item.id}
                        variant={wrong === item.id ? 'destructive' : 'outline'}
                        disabled={done || busy}
                        className={cn(
                           'h-auto min-h-11 min-w-0 justify-start whitespace-normal px-2 py-2 text-left wrap-anywhere sm:px-3',
                           done && 'opacity-50',
                        )}
                        onClick={() => void tryMatch(item.id)}
                     >
                        {item.label}
                     </Button>
                  );
               })}
            </div>
         </CardContent>
      </UICard>
   );
}
