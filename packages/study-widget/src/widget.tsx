import { useEffect, useMemo, useState } from 'react';
import { Button } from '@caly/ui/components/button';
import { Card as UICard, CardContent } from '@caly/ui/components/card';
import { MatchingPairs, StudyCard, type PairSignals } from '@caly/ui/study';
import {
   MATCHING_BATCH_SIZE,
   gradeFromPerformance,
   type MatchingVariant,
   type ReviewResponse,
   type StudySessionSnapshot,
   type StudyWidgetCard,
} from '@caly/shared';
import { createBridge } from './bridge';

function isSnapshot(value: unknown): value is StudySessionSnapshot {
   return (
      !!value &&
      typeof value === 'object' &&
      'sessionId' in value &&
      Array.isArray((value as { cards?: unknown }).cards)
   );
}

function parseJson(text: unknown): unknown {
   if (typeof text !== 'string') return null;
   try {
      return JSON.parse(text);
   } catch {
      return null;
   }
}

function pickSnapshot(payload: unknown): StudySessionSnapshot | null {
   if (!payload || typeof payload !== 'object') return null;
   const record = payload as Record<string, unknown>;
   const nested = record.result as Record<string, unknown> | undefined;
   const candidates = [
      record.structuredContent,
      nested?.structuredContent,
      record.snapshot,
      parseJson(record.text),
      payload,
   ];
   for (const candidate of candidates) if (isSnapshot(candidate)) return candidate;

   const content = record.content ?? nested?.content;
   if (Array.isArray(content)) {
      for (const block of content) {
         if (block && typeof block === 'object' && (block as { type?: unknown }).type === 'text') {
            const candidate = parseJson((block as { text?: unknown }).text);
            if (isSnapshot(candidate)) return candidate;
         }
      }
   }
   return null;
}

export function StudyWidget() {
   const bridge = useMemo(() => createBridge(), []);
   const [snapshot, setSnapshot] = useState<StudySessionSnapshot | null>(null);
   const [reviewed, setReviewed] = useState<string[]>([]);
   const [busy, setBusy] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [variant, setVariant] = useState<MatchingVariant>('pairs');
   const [pairBatch, setPairBatch] = useState<string[]>([]);

   function adopt(next: StudySessionSnapshot) {
      setSnapshot(next);
      setReviewed(next.reviewedCardIds ?? []);
      setError(null);
      setPairBatch([]);
   }

   useEffect(() => {
      const off = bridge.onSnapshot((payload) => {
         const next = pickSnapshot(payload);
         if (next) adopt(next);
      });
      // Optional, feature-detected ChatGPT extension for initial data.
      const host = window as unknown as { openai?: { toolOutput?: unknown } };
      if (host.openai?.toolOutput) {
         const next = pickSnapshot({ structuredContent: host.openai.toolOutput });
         if (next) adopt(next);
      }
      return off;
   }, [bridge]);

   const total = snapshot?.total ?? snapshot?.cards.length ?? 0;
   const remaining = useMemo(
      () => snapshot?.cards.filter((item) => !reviewed.includes(item.id)) ?? [],
      [snapshot, reviewed],
   );
   const card: StudyWidgetCard | null = remaining[0] ?? null;
   const pairMode = snapshot?.mode === 'matching' && variant === 'pairs' && remaining.length >= 2;
   const pairCards = useMemo(
      () =>
         pairBatch
            .map((id) => snapshot?.cards.find((item) => item.id === id))
            .filter((item): item is StudyWidgetCard => Boolean(item)),
      [pairBatch, snapshot],
   );

   // Seed a pairing batch from the unreviewed cards; keep it stable until every
   // pair in the batch has been matched.
   useEffect(() => {
      if (!pairMode) {
         if (pairBatch.length > 0) setPairBatch([]);
         return;
      }
      const known = new Set(snapshot?.cards.map((item) => item.id) ?? []);
      if (pairBatch.length > 0 && pairBatch.every((id) => known.has(id))) return;
      setPairBatch(remaining.slice(0, MATCHING_BATCH_SIZE).map((item) => item.id));
   }, [pairMode, pairBatch, remaining, snapshot]);

   async function submitCard(target: StudyWidgetCard, response: ReviewResponse): Promise<boolean> {
      if (busy || !snapshot) return false;
      setBusy(true);
      setError(null);
      try {
         await bridge.callTool('record_review', {
            sessionId: snapshot.sessionId,
            cardId: target.id,
            response,
         });
         setReviewed((ids) => (ids.includes(target.id) ? ids : [...ids, target.id]));
         bridge.updateModelContext(`Graded the card as ${response}.`);
         return true;
      } catch {
         setError('Could not save that review. Try again.');
         return false;
      } finally {
         setBusy(false);
      }
   }

   async function recordPair(target: StudyWidgetCard, signals: PairSignals): Promise<boolean> {
      const response = gradeFromPerformance({ correct: true, ...signals });
      return submitCard(target, response);
   }

   if (!snapshot) {
      return (
         <p className='p-4 text-sm text-muted-foreground'>
            {bridge.isHosted
               ? 'Waiting for a study session…'
               : 'Open this widget from a chat host.'}
         </p>
      );
   }

   const progress = total > 0 ? Math.round((reviewed.length / total) * 100) : 0;
   const header = (
      <div className='flex flex-col gap-1.5 px-1'>
         <div className='flex items-center justify-between text-xs text-muted-foreground'>
            <span className='font-medium text-foreground'>{snapshot.deckTitle}</span>
            <span>
               {reviewed.length} / {total}
            </span>
         </div>
         <div className='h-1.5 overflow-hidden rounded-full bg-muted'>
            <span
               className='block h-full bg-primary transition-all'
               style={{ width: `${progress}%` }}
            />
         </div>
         {snapshot.mode === 'matching' && remaining.length >= 2 && (
            <div className='flex gap-1 pt-1'>
               {(['pairs', 'choice'] as const).map((option) => (
                  <Button
                     key={option}
                     variant={variant === option ? 'default' : 'outline'}
                     size='xs'
                     onClick={() => setVariant(option)}
                  >
                     {option === 'pairs' ? 'Pairs' : 'Choice'}
                  </Button>
               ))}
            </div>
         )}
      </div>
   );

   if (!card) {
      return (
         <div className='flex flex-col gap-3'>
            {header}
            <UICard>
               <CardContent className='py-10 text-center text-sm'>
                  {snapshot.status === 'active'
                     ? 'All cards reviewed.'
                     : `Session ${snapshot.status}.`}
               </CardContent>
            </UICard>
         </div>
      );
   }

   if (pairMode) {
      return (
         <div className='flex flex-col gap-3'>
            {header}
            <MatchingPairs
               key={pairBatch.join('|')}
               cards={pairCards}
               busy={busy}
               onPair={recordPair}
               onComplete={() => setPairBatch([])}
            />
            <p className='text-center text-xs text-muted-foreground'>
               Pick a term, then its match.
            </p>
            {error && <p className='text-center text-sm text-destructive'>{error}</p>}
         </div>
      );
   }

   return (
      <div className='flex flex-col gap-3'>
         {header}
         <StudyCard
            key={card.id}
            card={card}
            mode={snapshot.mode}
            pool={remaining}
            busy={busy}
            onAnswered={(response) => void submitCard(card, response)}
         />
         {error && <p className='text-center text-sm text-destructive'>{error}</p>}
      </div>
   );
}
