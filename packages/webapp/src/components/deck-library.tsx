import { useCallback, useEffect, useState } from 'react';
import type { ComponentChildren } from 'preact';
import { useLocation } from 'preact-iso';
import { Button } from '@caly/ui/components/button';
import { Input } from '@caly/ui/components/input';
import { Label } from '@caly/ui/components/label';
import { Select } from '@caly/ui/components/select';
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
import { cn } from '@caly/ui/lib/utils';
import { MAX_CARDS_PER_DECK, type Collection, type Deck } from '@caly/shared';
import { ApiError } from '../lib/api/client';
import {
   createCollection,
   deleteCollection,
   listCollections,
   updateCollection,
} from '../lib/api/collections';
import { createDeck, downloadDeckExport, listDecks, updateDeck } from '../lib/api/decks';

type Filter = { kind: 'all' } | { kind: 'unfiled' } | { kind: 'collection'; id: string };

const ALL: Filter = { kind: 'all' };

function filterQuery(filter: Filter) {
   if (filter.kind === 'collection') return { collectionId: filter.id };
   if (filter.kind === 'unfiled') return { unfiled: true };
   return {};
}

function DeckMenuItems({
   deck,
   collections,
   onClose,
   onMove,
}: {
   deck: Deck;
   collections: Collection[];
   onClose: () => void;
   onMove: (deck: Deck, collectionId: string | null) => void;
}) {
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
               Move to collection
               <span className='text-muted-foreground'>›</span>
            </summary>
            <div className='absolute right-full top-0 mr-1 min-w-40 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md'>
               <button
                  type='button'
                  className={cn(
                     'flex w-full items-center rounded-md px-2 py-1 text-left text-xs hover:bg-muted',
                     deck.collectionId === null && 'font-medium',
                  )}
                  onClick={() => {
                     onClose();
                     onMove(deck, null);
                  }}
               >
                  No collection
               </button>
               {collections.map((collection) => (
                  <button
                     key={collection.id}
                     type='button'
                     className={cn(
                        'flex w-full items-center rounded-md px-2 py-1 text-left text-xs hover:bg-muted',
                        deck.collectionId === collection.id && 'font-medium',
                     )}
                     onClick={() => {
                        onClose();
                        onMove(deck, collection.id);
                     }}
                  >
                     {collection.name}
                  </button>
               ))}
               {collections.length === 0 && (
                  <p className='px-2 py-1 text-xs text-muted-foreground'>No collections yet.</p>
               )}
            </div>
         </details>
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
   const [collections, setCollections] = useState<Collection[]>([]);
   const [filter, setFilter] = useState<Filter>(ALL);
   const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'auth'>('loading');
   const [error, setError] = useState<string | null>(null);
   const [title, setTitle] = useState('');
   const [deckCollectionId, setDeckCollectionId] = useState('');
   const [open, setOpen] = useState(false);
   const [collectionOpen, setCollectionOpen] = useState(false);
   const [collectionName, setCollectionName] = useState('');
   const [renaming, setRenaming] = useState<Collection | null>(null);
   const [renameValue, setRenameValue] = useState('');
   const [menuId, setMenuId] = useState<string | null>(null);
   const [cursor, setCursor] = useState<string | undefined>(undefined);
   const [hasMore, setHasMore] = useState(false);
   const [loadingMore, setLoadingMore] = useState(false);

   const loadCollections = useCallback(() => {
      listCollections()
         .then((result) => setCollections(result.data))
         .catch(() => undefined);
   }, []);

   const load = useCallback((next: Filter) => {
      setStatus('loading');
      setFilter(next);
      listDecks(filterQuery(next))
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

   useEffect(() => loadCollections(), [loadCollections]);
   useEffect(() => load(ALL), [load]);

   useEffect(() => {
      if (!menuId) return;
      const close = () => setMenuId(null);
      document.addEventListener('click', close);
      return () => document.removeEventListener('click', close);
   }, [menuId]);

   async function loadMore() {
      setLoadingMore(true);
      try {
         const result = await listDecks({ ...filterQuery(filter), cursor });
         setDecks((current) => [...current, ...result.data]);
         setCursor(result.meta.nextCursor ?? undefined);
         setHasMore(result.meta.hasMore);
      } finally {
         setLoadingMore(false);
      }
   }

   async function submitDeck(event: Event) {
      event.preventDefault();
      if (!title.trim()) return;
      await createDeck({
         title: title.trim(),
         ...(deckCollectionId ? { collectionId: deckCollectionId } : {}),
      });
      setTitle('');
      setDeckCollectionId('');
      setOpen(false);
      loadCollections();
      load(filter);
   }

   async function submitCollection(event: Event) {
      event.preventDefault();
      if (!collectionName.trim()) return;
      try {
         const result = await createCollection({ name: collectionName.trim() });
         setCollectionName('');
         setCollectionOpen(false);
         setCollections((current) => [...current, result.data]);
         load({ kind: 'collection', id: result.data.id });
      } catch (cause) {
         setError(cause instanceof ApiError ? cause.message : 'Failed to create collection');
      }
   }

   async function removeCollection(collection: Collection) {
      if (!window.confirm(`Delete “${collection.name}”? Its decks move to no collection.`)) return;
      await deleteCollection(collection.id).catch(() => undefined);
      setCollections((current) => current.filter((item) => item.id !== collection.id));
      if (filter.kind === 'collection' && filter.id === collection.id) load(ALL);
      else load(filter);
   }

   async function moveDeck(deck: Deck, collectionId: string | null) {
      await updateDeck(deck.id, { collectionId }).catch(() => undefined);
      loadCollections();
      load(filter);
   }

   function startRename(collection: Collection) {
      setRenaming(collection);
      setRenameValue(collection.name);
   }

   async function submitRename(event: Event) {
      event.preventDefault();
      if (!renaming || !renameValue.trim()) return;
      try {
         const result = await updateCollection(renaming.id, { name: renameValue.trim() });
         setCollections((current) =>
            current.map((item) => (item.id === result.data.id ? result.data : item)),
         );
         if (filter.kind === 'collection' && filter.id === result.data.id) {
            setFilter({ kind: 'collection', id: result.data.id });
         }
         setRenaming(null);
      } catch (cause) {
         setError(cause instanceof ApiError ? cause.message : 'Failed to rename collection');
      }
   }

   /** Swap positions with the neighbour; no drag-and-drop and no renumbering pass. */
   async function reorderCollection(collection: Collection, direction: -1 | 1) {
      const index = collections.findIndex((item) => item.id === collection.id);
      if (index < 0) return;
      const neighbour = collections[index + direction];
      if (!neighbour) return;
      try {
         if (collection.position === neighbour.position) {
            // Defensive fallback for legacy rows that share a position: renumber
            // the visible list in order, changing only the rows that need it.
            const ordered = [...collections];
            [ordered[index], ordered[index + direction]] = [
               ordered[index + direction]!,
               ordered[index]!,
            ];
            await Promise.all(
               ordered.map((item, position) =>
                  item.position === position + 1
                     ? null
                     : updateCollection(item.id, { position: position + 1 }),
               ),
            );
         } else {
            await Promise.all([
               updateCollection(collection.id, { position: neighbour.position }),
               updateCollection(neighbour.id, { position: collection.position }),
            ]);
         }
         loadCollections();
      } catch (cause) {
         setError(cause instanceof ApiError ? cause.message : 'Failed to reorder collections');
      }
   }

   const collectionNameById = new Map(collections.map((item) => [item.id, item.name]));
   const activeCollection =
      filter.kind === 'collection' ? collections.find((item) => item.id === filter.id) : null;

   return (
      <section className='flex flex-col gap-4'>
         <div className='flex flex-wrap items-center justify-between gap-4'>
            <h2 className='font-heading text-lg font-medium'>Your decks</h2>
            <div className='flex flex-wrap items-center gap-2'>
               <Dialog
                  open={collectionOpen}
                  onOpenChange={setCollectionOpen}
               >
                  <DialogTrigger render={<Button variant='outline' />}>
                     New collection
                  </DialogTrigger>
                  <DialogContent>
                     <form onSubmit={submitCollection}>
                        <DialogHeader>
                           <DialogTitle>Create a collection</DialogTitle>
                           <DialogDescription>
                              Group decks without moving tags out of them.
                           </DialogDescription>
                        </DialogHeader>
                        <div className='flex flex-col gap-1.5 py-3'>
                           <Label htmlFor='collection-name'>Name</Label>
                           <Input
                              id='collection-name'
                              value={collectionName}
                              autoFocus
                              maxLength={80}
                              onInput={(event) =>
                                 setCollectionName((event.target as HTMLInputElement).value)
                              }
                           />
                        </div>
                        <DialogFooter>
                           <Button type='submit'>Create</Button>
                        </DialogFooter>
                     </form>
                  </DialogContent>
               </Dialog>

               <Dialog
                  open={renaming !== null}
                  onOpenChange={(next) => {
                     if (!next) setRenaming(null);
                  }}
               >
                  <DialogContent>
                     <form onSubmit={submitRename}>
                        <DialogHeader>
                           <DialogTitle>Rename collection</DialogTitle>
                           <DialogDescription>The decks inside keep their place.</DialogDescription>
                        </DialogHeader>
                        <div className='flex flex-col gap-1.5 py-3'>
                           <Label htmlFor='collection-rename'>Name</Label>
                           <Input
                              id='collection-rename'
                              value={renameValue}
                              autoFocus
                              maxLength={80}
                              onInput={(event) =>
                                 setRenameValue((event.target as HTMLInputElement).value)
                              }
                           />
                        </div>
                        <DialogFooter>
                           <Button type='submit'>Save</Button>
                        </DialogFooter>
                     </form>
                  </DialogContent>
               </Dialog>

               <Dialog
                  open={open}
                  onOpenChange={setOpen}
               >
                  <DialogTrigger render={<Button />}>New deck</DialogTrigger>
                  <DialogContent>
                     <form onSubmit={submitDeck}>
                        <DialogHeader>
                           <DialogTitle>Create a deck</DialogTitle>
                           <DialogDescription>
                              Give it a title and, optionally, a collection.
                           </DialogDescription>
                        </DialogHeader>
                        <div className='flex flex-col gap-3 py-3'>
                           <div className='flex flex-col gap-1.5'>
                              <Label htmlFor='deck-title'>Title</Label>
                              <Input
                                 id='deck-title'
                                 value={title}
                                 autoFocus
                                 onInput={(event) =>
                                    setTitle((event.target as HTMLInputElement).value)
                                 }
                              />
                           </div>
                           <div className='flex flex-col gap-1.5'>
                              <Label htmlFor='deck-collection'>Collection</Label>
                              <Select
                                 id='deck-collection'
                                 value={deckCollectionId}
                                 onValueChange={setDeckCollectionId}
                                 items={[
                                    { value: '', label: 'No collection' },
                                    ...collections.map((collection) => ({
                                       value: collection.id,
                                       label: collection.name,
                                    })),
                                 ]}
                              />
                           </div>
                        </div>
                        <DialogFooter>
                           <Button type='submit'>Create</Button>
                        </DialogFooter>
                     </form>
                  </DialogContent>
               </Dialog>
            </div>
         </div>

         {collections.length > 0 && (
            <div className='flex flex-wrap items-center gap-1.5'>
               <FilterChip
                  active={filter.kind === 'all'}
                  onClick={() => load(ALL)}
               >
                  All decks
               </FilterChip>
               <FilterChip
                  active={filter.kind === 'unfiled'}
                  onClick={() => load({ kind: 'unfiled' })}
               >
                  No collection
               </FilterChip>
               {collections.map((collection, index) => (
                  <span
                     key={collection.id}
                     className='inline-flex items-center'
                  >
                     <FilterChip
                        active={filter.kind === 'collection' && filter.id === collection.id}
                        onClick={() => load({ kind: 'collection', id: collection.id })}
                     >
                        {collection.name} · {collection.deckCount}
                     </FilterChip>
                     <span className='-ml-1 flex items-center'>
                        <button
                           type='button'
                           title={`Move ${collection.name} up`}
                           aria-label={`Move ${collection.name} up`}
                           disabled={index === 0}
                           className='px-0.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30'
                           onClick={() => void reorderCollection(collection, -1)}
                        >
                           ↑
                        </button>
                        <button
                           type='button'
                           title={`Move ${collection.name} down`}
                           aria-label={`Move ${collection.name} down`}
                           disabled={index === collections.length - 1}
                           className='px-0.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30'
                           onClick={() => void reorderCollection(collection, 1)}
                        >
                           ↓
                        </button>
                        <button
                           type='button'
                           title={`Rename ${collection.name}`}
                           aria-label={`Rename ${collection.name}`}
                           className='px-0.5 text-xs text-muted-foreground hover:text-foreground'
                           onClick={() => startRename(collection)}
                        >
                           ✎
                        </button>
                        <button
                           type='button'
                           title={`Delete ${collection.name}`}
                           aria-label={`Delete ${collection.name}`}
                           className='px-0.5 text-xs text-muted-foreground hover:text-destructive'
                           onClick={() => void removeCollection(collection)}
                        >
                           ×
                        </button>
                     </span>
                  </span>
               ))}
            </div>
         )}

         {activeCollection && (
            <p className='text-xs text-muted-foreground'>
               Showing decks in “{activeCollection.name}”.
            </p>
         )}

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
                  <EmptyTitle>
                     {filter.kind === 'all' ? 'No decks yet' : 'Nothing filed here yet'}
                  </EmptyTitle>
                  <EmptyDescription>
                     {filter.kind === 'all'
                        ? 'Create your first deck to start studying.'
                        : 'Create a deck or move an existing one into this collection.'}
                  </EmptyDescription>
               </EmptyHeader>
               <EmptyContent>
                  <Button onClick={() => setOpen(true)}>New deck</Button>
               </EmptyContent>
            </Empty>
         ) : status === 'ready' ? (
            <div className='grid gap-4 sm:grid-cols-2'>
               {decks.map((deck) => {
                  const full = deck.cardCount >= MAX_CARDS_PER_DECK;
                  return (
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
                                          collections={collections}
                                          onClose={() => setMenuId(null)}
                                          onMove={(item, collectionId) =>
                                             void moveDeck(item, collectionId)
                                          }
                                       />
                                    </div>
                                 )}
                              </div>
                           </CardAction>
                        </CardHeader>
                        <CardContent className='flex flex-wrap gap-2'>
                           <Badge variant='secondary'>
                              {deck.cardCount} / {MAX_CARDS_PER_DECK} cards
                           </Badge>
                           {deck.collectionId && (
                              <Badge variant='outline'>
                                 {collectionNameById.get(deck.collectionId) ?? 'Collection'}
                              </Badge>
                           )}
                           {full && <Badge variant='destructive'>Full</Badge>}
                        </CardContent>
                     </Card>
                  );
               })}
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

function FilterChip({
   active,
   onClick,
   children,
}: {
   active: boolean;
   onClick: () => void;
   children: ComponentChildren;
}) {
   return (
      <button
         type='button'
         onClick={onClick}
         className={cn(
            'rounded-full border px-3 py-1 text-xs transition-colors',
            active
               ? 'border-primary bg-primary text-primary-foreground'
               : 'border-border hover:bg-muted',
         )}
      >
         {children}
      </button>
   );
}
