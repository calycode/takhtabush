import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'preact-iso';
import { Button } from '@caly/ui/components/button';
import { Input } from '@caly/ui/components/input';
import { Label } from '@caly/ui/components/label';
import {
   Card,
   CardAction,
   CardContent,
   CardDescription,
   CardHeader,
   CardTitle,
} from '@caly/ui/components/card';
import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
   DialogTrigger,
} from '@caly/ui/components/dialog';
import {
   Empty,
   EmptyContent,
   EmptyDescription,
   EmptyHeader,
   EmptyTitle,
} from '@caly/ui/components/empty';
import { Badge } from '@caly/ui/components/badge';
import { Skeleton } from '@caly/ui/components/skeleton';
import { Alert, AlertDescription } from '@caly/ui/components/alert';
import type { Deck } from '@caly/shared';
import { ApiError } from '../lib/api/client';
import { createDeck, downloadDeckExport, listDecks } from '../lib/api/decks';

function DeckMenuItems({ deck, onClose }: { deck: Deck; onClose: () => void }) {
   const { route } = useLocation();
   return (
      <>
         <button
            type='button'
            className='flex w-full items-center rounded-md px-2 py-1 text-left text-xs hover:bg-muted'
            onClick={() => {
               onClose();
               route(`/decks/${deck.id}/edit`);
            }}
         >
            Edit deck
         </button>
         <details className='group/sub relative'>
            <summary className='flex cursor-pointer list-none items-center justify-between gap-2 rounded-md px-2 py-1 text-xs hover:bg-muted [&::-webkit-details-marker]:hidden'>
               Export
               <span className='text-muted-foreground'>›</span>
            </summary>
            <div className='absolute right-full top-0 mr-1 min-w-24 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md'>
               {(['csv', 'tsv', 'json'] as const).map((format) => (
                  <button
                     key={format}
                     type='button'
                     className='flex w-full items-center rounded-md px-2 py-1 text-left text-xs hover:bg-muted'
                     onClick={() => {
                        onClose();
                        void downloadDeckExport(deck.id, format);
                     }}
                  >
                     {format.toUpperCase()}
                  </button>
               ))}
            </div>
         </details>
      </>
   );
}

export function DeckLibrary() {
   const [decks, setDecks] = useState<Deck[]>([]);
   const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'auth'>('loading');
   const [error, setError] = useState<string | null>(null);
   const [title, setTitle] = useState('');
   const [open, setOpen] = useState(false);
   const [menuId, setMenuId] = useState<string | null>(null);
   const [cursor, setCursor] = useState<string | undefined>(undefined);
   const [hasMore, setHasMore] = useState(false);
   const [loadingMore, setLoadingMore] = useState(false);

   const refresh = useCallback(() => {
      setStatus('loading');
      listDecks()
         .then((result) => {
            setDecks(result.data);
            setCursor(result.meta.nextCursor ?? undefined);
            setHasMore(result.meta.hasMore);
            setStatus('ready');
         })
         .catch((cause) => {
            if (cause instanceof ApiError && cause.status === 401) {
               setStatus('auth');
               return;
            }
            setError(cause instanceof ApiError ? cause.message : 'Failed to load decks');
            setStatus('error');
         });
   }, []);

   useEffect(() => refresh(), [refresh]);

   useEffect(() => {
      if (!menuId) return;
      const close = () => setMenuId(null);
      document.addEventListener('click', close);
      return () => document.removeEventListener('click', close);
   }, [menuId]);

   async function loadMore() {
      setLoadingMore(true);
      try {
         const result = await listDecks(cursor);
         setDecks((current) => [...current, ...result.data]);
         setCursor(result.meta.nextCursor ?? undefined);
         setHasMore(result.meta.hasMore);
      } finally {
         setLoadingMore(false);
      }
   }

   async function submit(event: Event) {
      event.preventDefault();
      if (!title.trim()) return;
      const result = await createDeck({ title: title.trim() });
      setDecks((current) => [result.data, ...current]);
      setTitle('');
      setOpen(false);
   }

   return (
      <section className='flex flex-col gap-4'>
         <div className='flex items-center justify-between gap-4'>
            <h2 className='font-heading text-lg font-medium'>Your decks</h2>
            <Dialog
               open={open}
               onOpenChange={setOpen}
            >
               <DialogTrigger render={<Button />}>New deck</DialogTrigger>
               <DialogContent>
                  <form onSubmit={submit}>
                     <DialogHeader>
                        <DialogTitle>Create a deck</DialogTitle>
                        <DialogDescription>Give it a title; add cards next.</DialogDescription>
                     </DialogHeader>
                     <div className='flex flex-col gap-1.5 py-3'>
                        <Label htmlFor='deck-title'>Title</Label>
                        <Input
                           id='deck-title'
                           value={title}
                           autoFocus
                           onInput={(event) => setTitle((event.target as HTMLInputElement).value)}
                        />
                     </div>
                     <DialogFooter>
                        <Button type='submit'>Create</Button>
                     </DialogFooter>
                  </form>
               </DialogContent>
            </Dialog>
         </div>

         {status === 'auth' && (
            <Alert variant='info'>
               <AlertDescription>Sign in to see your decks.</AlertDescription>
            </Alert>
         )}

         {status === 'error' && (
            <Alert variant='destructive'>
               <AlertDescription>{error}</AlertDescription>
            </Alert>
         )}

         {status === 'loading' ? (
            <div className='grid gap-4 sm:grid-cols-2'>
               <Skeleton className='h-28' />
               <Skeleton className='h-28' />
            </div>
         ) : status === 'ready' && decks.length === 0 ? (
            <Empty>
               <EmptyHeader>
                  <EmptyTitle>No decks yet</EmptyTitle>
                  <EmptyDescription>Create your first deck to start studying.</EmptyDescription>
               </EmptyHeader>
               <EmptyContent>
                  <Button onClick={() => setOpen(true)}>New deck</Button>
               </EmptyContent>
            </Empty>
         ) : status === 'ready' ? (
            <div className='grid gap-4 sm:grid-cols-2'>
               {decks.map((deck) => (
                  <Card
                     key={deck.id}
                     className='relative overflow-visible transition-colors hover:bg-muted/40'
                     onContextMenu={(event) => {
                        event.preventDefault();
                        setMenuId(deck.id);
                     }}
                  >
                     <a
                        href={`/decks/${deck.id}`}
                        className='absolute inset-0 rounded-lg'
                        aria-label={`Open deck ${deck.title}`}
                     />
                     <CardHeader>
                        <CardTitle>{deck.title}</CardTitle>
                        <CardDescription>{deck.description || 'No description'}</CardDescription>
                        <CardAction>
                           <div
                              className='relative z-10'
                              onClick={(event) => event.stopPropagation()}
                           >
                              <Button
                                 variant='ghost'
                                 size='icon-sm'
                                 aria-label='Deck actions'
                                 onClick={(event) => {
                                    event.preventDefault();
                                    setMenuId(menuId === deck.id ? null : deck.id);
                                 }}
                              >
                                 ⋯
                              </Button>
                              {menuId === deck.id && (
                                 <div className='absolute right-0 top-full mt-1 min-w-40 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md'>
                                    <DeckMenuItems
                                       deck={deck}
                                       onClose={() => setMenuId(null)}
                                    />
                                 </div>
                              )}
                           </div>
                        </CardAction>
                     </CardHeader>
                     <CardContent>
                        <Badge variant='secondary'>{deck.cardCount} cards</Badge>
                     </CardContent>
                  </Card>
               ))}
            </div>
         ) : null}

         {status === 'ready' && hasMore && (
            <div className='flex justify-center'>
               <Button
                  variant='outline'
                  size='sm'
                  disabled={loadingMore}
                  onClick={() => void loadMore()}
               >
                  {loadingMore ? 'Loading…' : 'Load more'}
               </Button>
            </div>
         )}
      </section>
   );
}
