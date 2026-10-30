import { useEffect, useState } from 'react';
import { useLocation } from 'preact-iso';
import { Button, buttonVariants } from '@caly/ui/components/button';
import { Input } from '@caly/ui/components/input';
import { Label } from '@caly/ui/components/label';
import { Textarea } from '@caly/ui/components/textarea';
import {
   Card,
   CardContent,
   CardDescription,
   CardHeader,
   CardTitle,
} from '@caly/ui/components/card';
import { Alert, AlertDescription } from '@caly/ui/components/alert';
import { Skeleton } from '@caly/ui/components/skeleton';
import { Select } from '@caly/ui/components/select';
import type { Collection, Deck } from '@caly/shared';
import { ApiError } from '../../lib/api/client';
import { listCollections } from '../../lib/api/collections';
import { deleteDeck, getDeck, updateDeck } from '../../lib/api/decks';

export function DeckEdit({ id }: { id?: string }) {
   const { route } = useLocation();
   const deckId = id ?? '';
   const [deck, setDeck] = useState<Deck | null>(null);
   const [title, setTitle] = useState('');
   const [description, setDescription] = useState('');
   const [collectionId, setCollectionId] = useState('');
   const [collections, setCollections] = useState<Collection[]>([]);
   const [error, setError] = useState<string | null>(null);
   const [saved, setSaved] = useState(false);

   useEffect(() => {
      listCollections()
         .then((result) => setCollections(result.data))
         .catch(() => undefined);
      getDeck(deckId)
         .then((result) => {
            setDeck(result.data);
            setTitle(result.data.title);
            setDescription(result.data.description ?? '');
            setCollectionId(result.data.collectionId ?? '');
         })
         .catch((cause) =>
            setError(cause instanceof ApiError ? cause.message : 'Failed to load deck'),
         );
   }, [deckId]);

   async function save(event: Event) {
      event.preventDefault();
      setSaved(false);
      try {
         const result = await updateDeck(deckId, {
            title,
            description: description || null,
            collectionId: collectionId || null,
         });
         setDeck(result.data);
         setSaved(true);
      } catch (cause) {
         setError(cause instanceof ApiError ? cause.message : 'Failed to save');
      }
   }

   async function remove() {
      await deleteDeck(deckId).catch(() => undefined);
      route('/decks');
   }

   if (!deck) {
      return error ? (
         <Alert variant='destructive'>
            <AlertDescription>{error}</AlertDescription>
         </Alert>
      ) : (
         <Skeleton className='h-48' />
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
            <h1 className='font-heading text-2xl font-medium'>Deck settings</h1>
         </div>
         <Card>
            <CardHeader>
               <CardTitle>{deck.title}</CardTitle>
               <CardDescription>Rename or describe this deck.</CardDescription>
            </CardHeader>
            <CardContent>
               <form
                  className='flex flex-col gap-3'
                  onSubmit={save}
               >
                  <div className='flex flex-col gap-1.5'>
                     <Label htmlFor='title'>Title</Label>
                     <Input
                        id='title'
                        value={title}
                        onInput={(event) => setTitle((event.target as HTMLInputElement).value)}
                     />
                  </div>
                  <div className='flex flex-col gap-1.5'>
                     <Label htmlFor='description'>Description</Label>
                     <Textarea
                        id='description'
                        value={description}
                        onInput={(event) =>
                           setDescription((event.target as HTMLTextAreaElement).value)
                        }
                     />
                  </div>
                  <div className='flex flex-col gap-1.5'>
                     <Label htmlFor='collection'>Collection</Label>
                     <Select
                        id='collection'
                        value={collectionId}
                        onValueChange={setCollectionId}
                        items={[
                           { value: '', label: 'No collection' },
                           ...collections.map((collection) => ({
                              value: collection.id,
                              label: collection.name,
                           })),
                        ]}
                     />
                  </div>
                  {saved && (
                     <Alert variant='info'>
                        <AlertDescription>Saved.</AlertDescription>
                     </Alert>
                  )}
                  <div className='flex items-center justify-between gap-2'>
                     <div className='flex gap-2'>
                        <Button
                           type='submit'
                           size='sm'
                        >
                           Save
                        </Button>
                        <a
                           href={`/decks/${deckId}`}
                           className={buttonVariants({ variant: 'outline', size: 'sm' })}
                        >
                           Back to deck
                        </a>
                     </div>
                     <Button
                        type='button'
                        size='sm'
                        variant='destructive'
                        onClick={() => void remove()}
                     >
                        Delete deck
                     </Button>
                  </div>
               </form>
            </CardContent>
         </Card>
      </section>
   );
}
