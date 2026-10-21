import { useEffect, useState } from 'react';
import { Button } from '@caly/ui/components/button';
import {
   Card,
   CardContent,
   CardDescription,
   CardHeader,
   CardTitle,
} from '@caly/ui/components/card';
import { Alert, AlertDescription } from '@caly/ui/components/alert';
import { buttonVariants } from '@caly/ui/components/button';
import { Skeleton } from '@caly/ui/components/skeleton';
import type { Card as CardType } from '@caly/shared';
import { ApiError } from '../../lib/api/client';
import { deleteCard, getCard, restoreCard, updateCard } from '../../lib/api/decks';
import { CardForm, type CardDraft } from '../../components/card-form';

export function CardEditor({ id, cardId }: { id?: string; cardId?: string }) {
   const deckId = id ?? '';
   const cardKey = cardId ?? '';
   const [card, setCard] = useState<CardType | null>(null);
   const [error, setError] = useState<string | null>(null);
   const [saved, setSaved] = useState(false);
   const [busy, setBusy] = useState(false);
   const [confirmDelete, setConfirmDelete] = useState(false);
   const [deleted, setDeleted] = useState(false);

   useEffect(() => {
      getCard(cardKey)
         .then((result) => setCard(result.data))
         .catch((cause) =>
            setError(cause instanceof ApiError ? cause.message : 'Failed to load card'),
         );
   }, [cardKey]);

   async function save(draft: CardDraft) {
      setSaved(false);
      setBusy(true);
      try {
         const result = await updateCard(cardKey, {
            front: draft.front,
            back: draft.back ?? null,
            clozeText: draft.clozeText ?? null,
            choices: draft.choices ?? null,
            correctChoice: draft.correctChoice ?? null,
            tags: draft.tags,
            imageMediaId: draft.imageMediaId ?? null,
            audioMediaId: draft.audioMediaId ?? null,
         });
         setCard(result.data);
         setSaved(true);
      } catch (cause) {
         setError(cause instanceof ApiError ? cause.message : 'Failed to save');
      } finally {
         setBusy(false);
      }
   }

   async function remove() {
      await deleteCard(cardKey).catch(() => undefined);
      setConfirmDelete(false);
      setDeleted(true);
   }

   async function undoDelete() {
      await restoreCard(cardKey).catch(() => undefined);
      setDeleted(false);
   }

   if (!card) {
      return error ? (
         <Alert variant='destructive'>
            <AlertDescription>{error}</AlertDescription>
         </Alert>
      ) : (
         <Skeleton className='h-64' />
      );
   }

   return (
      <section className='mx-auto flex max-w-xl flex-col gap-4'>
         <div className='flex flex-col gap-1'>
            <a
               href={`/decks/${deckId}`}
               className='inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground'
            >
               ← Back to deck
            </a>
            <h1 className='font-heading text-2xl font-medium'>Edit card</h1>
         </div>
         <Card>
            <CardHeader>
               <CardTitle>Card details</CardTitle>
               <CardDescription>
                  Type: {card.type.replace('_', ' ')} — the type can’t be changed
               </CardDescription>
            </CardHeader>
            <CardContent className='flex flex-col gap-3'>
               <CardForm
                  initial={{
                     type: card.type,
                     front: card.front,
                     back: card.back,
                     clozeText: card.clozeText,
                     choices: card.choices,
                     correctChoice: card.correctChoice,
                     tags: card.tags,
                     imageMediaId: card.imageMediaId,
                     audioMediaId: card.audioMediaId,
                  }}
                  typeLocked
                  submitLabel='Save'
                  busy={busy || deleted}
                  onSubmit={(draft) => void save(draft)}
               />
               {saved && !deleted && (
                  <Alert variant='info'>
                     <AlertDescription>Saved.</AlertDescription>
                  </Alert>
               )}
               {error && (
                  <Alert variant='destructive'>
                     <AlertDescription>{error}</AlertDescription>
                  </Alert>
               )}
               {deleted ? (
                  <div className='flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm'>
                     <span className='text-muted-foreground'>Card deleted.</span>
                     <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        onClick={() => void undoDelete()}
                     >
                        Undo
                     </Button>
                  </div>
               ) : confirmDelete ? (
                  <div className='flex items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2'>
                     <span className='text-xs'>Delete this card?</span>
                     <div className='flex gap-2'>
                        <Button
                           type='button'
                           size='sm'
                           variant='destructive'
                           onClick={() => void remove()}
                        >
                           Delete
                        </Button>
                        <Button
                           type='button'
                           size='sm'
                           variant='ghost'
                           onClick={() => setConfirmDelete(false)}
                        >
                           Cancel
                        </Button>
                     </div>
                  </div>
               ) : (
                  <div className='flex items-center justify-between gap-2'>
                     <Button
                        type='button'
                        size='sm'
                        variant='destructive'
                        onClick={() => setConfirmDelete(true)}
                     >
                        Delete card
                     </Button>
                     <a
                        href={`/decks/${deckId}`}
                        className={buttonVariants({ variant: 'outline', size: 'sm' })}
                     >
                        Back to deck
                     </a>
                  </div>
               )}
            </CardContent>
         </Card>
      </section>
   );
}
