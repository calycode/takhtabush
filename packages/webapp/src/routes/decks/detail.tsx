import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'preact-iso';
import { Button, buttonVariants } from '@caly/ui/components/button';
import { Input } from '@caly/ui/components/input';
import { Card, CardContent, CardHeader } from '@caly/ui/components/card';
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
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuSub,
   DropdownMenuSubContent,
   DropdownMenuSubTrigger,
   DropdownMenuTrigger,
} from '@caly/ui/components/dropdown-menu';
import {
   Empty,
   EmptyContent,
   EmptyDescription,
   EmptyHeader,
   EmptyTitle,
} from '@caly/ui/components/empty';
import { Badge } from '@caly/ui/components/badge';
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from '@caly/ui/components/table';
import { Skeleton } from '@caly/ui/components/skeleton';
import { Alert, AlertDescription } from '@caly/ui/components/alert';
import { markdownToText, type Card as CardType, type Deck } from '@caly/shared';
import { Markdown } from '@caly/ui/markdown';
import { ApiError } from '../../lib/api/client';
import {
   createCard,
   deleteCard,
   downloadDeckExport,
   getDeck,
   listCards,
   restoreCard,
   resumeCard,
   suspendCard,
} from '../../lib/api/decks';
import { startSession } from '../../lib/api/study';
import { CardForm, type CardDraft } from '../../components/card-form';
import { StudyLauncher, type StudyConfig } from '../../components/study-launcher';

function answerPreview(card: CardType): string {
   if (card.back) return markdownToText(card.back);
   if (card.clozeText) return card.clozeText;
   if (card.choices && card.correctChoice !== null) return card.choices[card.correctChoice] ?? '—';
   return '—';
}

/** Render the stored definition as markdown; other card types show plain text. */
function AnswerContent({ card }: { card: CardType }) {
   if (card.back) return <Markdown source={card.back} />;
   return <>{answerPreview(card)}</>;
}

export function DeckDetail({ id }: { id?: string }) {
   const { route } = useLocation();
   const deckId = id ?? '';
   const [deck, setDeck] = useState<Deck | null>(null);
   const [cards, setCards] = useState<CardType[]>([]);
   const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
   const [error, setError] = useState<string | null>(null);
   const [addOpen, setAddOpen] = useState(false);
   const [selectedCard, setSelectedCard] = useState<CardType | null>(null);
   const [confirmDelete, setConfirmDelete] = useState(false);
   const [deleted, setDeleted] = useState(false);
   const [busy, setBusy] = useState(false);
   const [tagFilter, setTagFilter] = useState('');
   const [cardCursor, setCardCursor] = useState<string | undefined>(undefined);
   const [cardHasMore, setCardHasMore] = useState(false);
   const [loadingMoreCards, setLoadingMoreCards] = useState(false);

   const refresh = useCallback(async () => {
      setStatus('loading');
      try {
         const [deckResult, cardPage] = await Promise.all([getDeck(deckId), listCards(deckId)]);
         setDeck(deckResult.data);
         setCards(cardPage.data);
         setCardCursor(cardPage.meta.nextCursor ?? undefined);
         setCardHasMore(cardPage.meta.hasMore);
         setStatus('ready');
      } catch (cause) {
         setError(cause instanceof ApiError ? cause.message : 'Failed to load deck');
         setStatus('error');
      }
   }, [deckId]);

   useEffect(() => {
      void refresh();
   }, [refresh]);

   async function loadMoreCards() {
      setLoadingMoreCards(true);
      try {
         const page = await listCards(deckId, cardCursor);
         setCards((current) => [...current, ...page.data]);
         setCardCursor(page.meta.nextCursor ?? undefined);
         setCardHasMore(page.meta.hasMore);
      } finally {
         setLoadingMoreCards(false);
      }
   }

   async function addCard(draft: CardDraft) {
      setBusy(true);
      try {
         const result = await createCard(deckId, draft);
         setCards((current) => [result.data, ...current]);
         setDeck((current) =>
            current ? { ...current, cardCount: current.cardCount + 1 } : current,
         );
         setAddOpen(false);
      } catch (cause) {
         setError(cause instanceof ApiError ? cause.message : 'Failed to add card');
      } finally {
         setBusy(false);
      }
   }

   async function removeCard(card: CardType) {
      await deleteCard(card.id);
      setCards((current) => current.filter((item) => item.id !== card.id));
      setDeck((current) =>
         current ? { ...current, cardCount: Math.max(0, current.cardCount - 1) } : current,
      );
      setConfirmDelete(false);
      setDeleted(true);
   }

   async function undoDelete() {
      if (!selectedCard) return;
      const restored = await restoreCard(selectedCard.id).catch(() => null);
      if (restored) {
         setCards((current) => [restored.data, ...current]);
         setDeck((current) =>
            current ? { ...current, cardCount: current.cardCount + 1 } : current,
         );
      }
      setDeleted(false);
   }

   async function togglePause(card: CardType) {
      const result =
         card.status === 'suspended' ? await resumeCard(card.id) : await suspendCard(card.id);
      setCards((current) => current.map((item) => (item.id === card.id ? result.data : item)));
      setSelectedCard((current) => (current?.id === card.id ? result.data : current));
   }

   async function handleStart(config: StudyConfig) {
      try {
         const result = await startSession({
            deckId,
            mode: config.mode,
            goal: config.goal,
            minutes: config.minutes,
         });
         const query = config.mode === 'matching' ? `?variant=${config.variant}` : '';
         route(`/study/${result.data.session.id}${query}`);
      } catch (cause) {
         setError(cause instanceof ApiError ? cause.message : 'Failed to start session');
      }
   }

   const visibleCards = useMemo(() => {
      const filter = tagFilter.trim().toLowerCase();
      if (!filter) return cards;
      return cards.filter((card) => card.tags.some((tag) => tag.toLowerCase().includes(filter)));
   }, [cards, tagFilter]);

   const allTags = useMemo(() => {
      const counts = new Map<string, number>();
      for (const card of cards) {
         for (const tag of card.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
      return [...counts.entries()]
         .map(([name, count]) => ({ name, count }))
         .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
   }, [cards]);

   if (status === 'loading') {
      return (
         <div className='flex flex-col gap-4'>
            <Skeleton className='h-8 w-64' />
            <Skeleton className='h-48' />
         </div>
      );
   }

   if (status === 'error' || !deck) {
      return (
         <Alert variant='destructive'>
            <AlertDescription>{error ?? 'Deck not found'}</AlertDescription>
         </Alert>
      );
   }

   const isEmpty = deck.cardCount === 0;

   return (
      <section className='flex flex-col gap-6'>
         <div className='flex flex-wrap items-start justify-between gap-3'>
            <div className='flex flex-col gap-1'>
               <h1 className='font-heading text-2xl font-medium'>{deck.title}</h1>
               <p className='text-sm text-muted-foreground'>
                  {deck.description || 'No description'}
               </p>
               <div className='flex gap-2'>
                  <Badge variant='secondary'>{deck.cardCount} cards</Badge>
               </div>
            </div>

            <div className='flex items-center gap-2'>
               <StudyLauncher
                  deckId={deck.id}
                  triggerDisabled={isEmpty}
                  onStart={(config) => void handleStart(config)}
               />

               <Dialog
                  open={addOpen}
                  onOpenChange={setAddOpen}
               >
                  <DialogTrigger render={<Button variant='outline' />}>Add card</DialogTrigger>
                  <DialogContent className='sm:max-w-lg'>
                     <DialogHeader>
                        <DialogTitle>Add a card</DialogTitle>
                        <DialogDescription>Pick a type and fill in the fields.</DialogDescription>
                     </DialogHeader>
                     <CardForm
                        submitLabel='Add card'
                        busy={busy}
                        onSubmit={(draft) => void addCard(draft)}
                     />
                  </DialogContent>
               </Dialog>

               <DropdownMenu>
                  <DropdownMenuTrigger className='border-0 px-2 text-base leading-none'>
                     ⋯
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                     <DropdownMenuItem onSelect={() => route(`/decks/${deck.id}/edit`)}>
                        Edit deck
                     </DropdownMenuItem>
                     <DropdownMenuItem onSelect={() => route(`/stats/${deck.id}`)}>
                        Statistics
                     </DropdownMenuItem>
                     <DropdownMenuItem onSelect={() => route(`/decks/${deck.id}/import`)}>
                        Import cards
                     </DropdownMenuItem>
                     <DropdownMenuSub>
                        <DropdownMenuSubTrigger>Export</DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                           {(['csv', 'tsv', 'json'] as const).map((fmt) => (
                              <DropdownMenuItem
                                 key={fmt}
                                 onSelect={() => void downloadDeckExport(deck.id, fmt)}
                              >
                                 {fmt.toUpperCase()}
                              </DropdownMenuItem>
                           ))}
                        </DropdownMenuSubContent>
                     </DropdownMenuSub>
                  </DropdownMenuContent>
               </DropdownMenu>
            </div>
         </div>

         {error && (
            <Alert variant='destructive'>
               <AlertDescription>{error}</AlertDescription>
            </Alert>
         )}

         {isEmpty ? (
            <Empty>
               <EmptyHeader>
                  <EmptyTitle>No cards yet</EmptyTitle>
                  <EmptyDescription>
                     Add cards one by one, or import a CSV, TSV, or JSON file.
                  </EmptyDescription>
               </EmptyHeader>
               <EmptyContent>
                  <Button onClick={() => setAddOpen(true)}>Add your first card</Button>
                  <a
                     href={`/decks/${deck.id}/import`}
                     className={buttonVariants({ variant: 'outline' })}
                  >
                     Import cards
                  </a>
               </EmptyContent>
            </Empty>
         ) : (
            <Card>
               <CardHeader className='border-b'>
                  <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                     <Input
                        className='sm:max-w-xs'
                        value={tagFilter}
                        placeholder='Filter by tag…'
                        onInput={(event) => setTagFilter((event.target as HTMLInputElement).value)}
                        aria-label='Filter cards by tag'
                     />
                     {allTags.length > 0 && (
                        <div className='flex flex-wrap items-center gap-1'>
                           {allTags.map((tag) => (
                              <button
                                 key={tag.name}
                                 type='button'
                                 onClick={() =>
                                    setTagFilter(tag.name === tagFilter ? '' : tag.name)
                                 }
                              >
                                 <Badge variant={tagFilter === tag.name ? 'default' : 'secondary'}>
                                    {tag.name} · {tag.count}
                                 </Badge>
                              </button>
                           ))}
                        </div>
                     )}
                  </div>
               </CardHeader>
               <CardContent className='flex flex-col gap-3'>
                  {visibleCards.length === 0 ? (
                     <p className='py-6 text-center text-sm text-muted-foreground'>
                        No cards match that tag.
                     </p>
                  ) : (
                     <Table>
                        <TableHeader>
                           <TableRow>
                              <TableHead>Front</TableHead>
                              <TableHead>Answer</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Tags</TableHead>
                              <TableHead />
                           </TableRow>
                        </TableHeader>
                        <TableBody>
                           {visibleCards.map((card) => (
                              <TableRow
                                 key={card.id}
                                 className='cursor-pointer'
                                 onClick={() => {
                                    setConfirmDelete(false);
                                    setSelectedCard(card);
                                 }}
                              >
                                 <TableCell className='font-medium'>{card.front}</TableCell>
                                 <TableCell className='text-muted-foreground'>
                                    <AnswerContent card={card} />
                                 </TableCell>
                                 <TableCell>
                                    <span className='flex flex-wrap gap-1'>
                                       <Badge variant='outline'>{card.type}</Badge>
                                       {card.status === 'suspended' && (
                                          <Badge variant='destructive'>paused</Badge>
                                       )}
                                    </span>
                                 </TableCell>
                                 <TableCell>
                                    <span className='flex flex-wrap gap-1'>
                                       {card.tags.map((tag) => (
                                          <Badge
                                             key={tag}
                                             variant='secondary'
                                          >
                                             {tag}
                                          </Badge>
                                       ))}
                                    </span>
                                 </TableCell>
                                 <TableCell className='text-right'>
                                    <div onClick={(event) => event.stopPropagation()}>
                                       <DropdownMenu>
                                          <DropdownMenuTrigger className='border-0 px-2 text-base leading-none'>
                                             ⋯
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent>
                                             <DropdownMenuItem
                                                onSelect={() =>
                                                   route(`/decks/${deck.id}/cards/${card.id}`)
                                                }
                                             >
                                                Edit
                                             </DropdownMenuItem>
                                             <DropdownMenuItem
                                                onSelect={() => void togglePause(card)}
                                             >
                                                {card.status === 'suspended'
                                                   ? 'Resume studying'
                                                   : 'Pause studying'}
                                             </DropdownMenuItem>
                                          </DropdownMenuContent>
                                       </DropdownMenu>
                                    </div>
                                 </TableCell>
                              </TableRow>
                           ))}
                        </TableBody>
                     </Table>
                  )}

                  {cardHasMore && (
                     <div className='flex justify-center'>
                        <Button
                           variant='outline'
                           size='sm'
                           disabled={loadingMoreCards}
                           onClick={() => void loadMoreCards()}
                        >
                           {loadingMoreCards ? 'Loading…' : 'Load more cards'}
                        </Button>
                     </div>
                  )}
               </CardContent>
            </Card>
         )}

         <Dialog
            open={selectedCard !== null}
            onOpenChange={(open) => {
               if (!open) {
                  setSelectedCard(null);
                  setConfirmDelete(false);
                  setDeleted(false);
               }
            }}
         >
            <DialogContent>
               <DialogHeader>
                  <DialogTitle>{selectedCard?.front}</DialogTitle>
                  <DialogDescription>Card details</DialogDescription>
               </DialogHeader>
               <div className='flex flex-col gap-2 py-2 text-sm'>
                  <div className='flex flex-col gap-1'>
                     <span className='text-muted-foreground'>Answer</span>
                     {selectedCard ? <AnswerContent card={selectedCard} /> : <span>—</span>}
                  </div>
                  <div className='flex items-center gap-2'>
                     <span className='text-muted-foreground'>Type: </span>
                     <Badge variant='outline'>{selectedCard?.type}</Badge>
                     {selectedCard?.status === 'suspended' && (
                        <Badge variant='destructive'>paused</Badge>
                     )}
                  </div>
                  {selectedCard && selectedCard.tags.length > 0 && (
                     <div className='flex flex-wrap items-center gap-1'>
                        <span className='text-muted-foreground'>Tags: </span>
                        {selectedCard.tags.map((tag) => (
                           <Badge
                              key={tag}
                              variant='secondary'
                           >
                              {tag}
                           </Badge>
                        ))}
                     </div>
                  )}
               </div>
               <DialogFooter>
                  {deleted ? (
                     <div className='flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2'>
                        <span className='text-sm text-muted-foreground'>Card deleted.</span>
                        <Button
                           size='sm'
                           variant='outline'
                           onClick={() => void undoDelete()}
                        >
                           Undo
                        </Button>
                     </div>
                  ) : (
                     <>
                        <a
                           href={selectedCard ? `/decks/${deck.id}/cards/${selectedCard.id}` : '#'}
                           className={buttonVariants({ variant: 'outline', size: 'sm' })}
                        >
                           Edit
                        </a>
                        <Button
                           size='sm'
                           variant='outline'
                           onClick={() => selectedCard && void togglePause(selectedCard)}
                        >
                           {selectedCard?.status === 'suspended'
                              ? 'Resume studying'
                              : 'Pause studying'}
                        </Button>
                        {confirmDelete ? (
                           <div className='flex w-full items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5'>
                              <span className='text-xs'>Delete this card?</span>
                              <div className='flex gap-2'>
                                 <Button
                                    size='sm'
                                    variant='destructive'
                                    onClick={() => selectedCard && void removeCard(selectedCard)}
                                 >
                                    Delete
                                 </Button>
                                 <Button
                                    size='sm'
                                    variant='ghost'
                                    onClick={() => setConfirmDelete(false)}
                                 >
                                    Cancel
                                 </Button>
                              </div>
                           </div>
                        ) : (
                           <Button
                              size='sm'
                              variant='destructive'
                              onClick={() => setConfirmDelete(true)}
                           >
                              Delete
                           </Button>
                        )}
                     </>
                  )}
               </DialogFooter>
            </DialogContent>
         </Dialog>
      </section>
   );
}
