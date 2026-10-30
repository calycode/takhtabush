import { useState } from 'react';
import { Button } from '@caly/ui/components/button';
import { Input } from '@caly/ui/components/input';
import { Label } from '@caly/ui/components/label';
import { Textarea } from '@caly/ui/components/textarea';
import { Select } from '@caly/ui/components/select';
import { MarkdownEditor } from '@caly/ui/markdown';
import { Alert, AlertDescription } from '@caly/ui/components/alert';
import type { CardType } from '@caly/shared';
import { MediaPicker } from './media-picker';
import { TagsField } from './tags-field';

export type CardDraft = {
   type: CardType;
   front: string;
   back?: string;
   clozeText?: string;
   choices?: string[];
   correctChoice?: number;
   tags: string[];
   imageMediaId?: string;
   audioMediaId?: string;
};

type InitialCard = Partial<{
   type: CardType;
   front: string;
   back: string | null;
   clozeText: string | null;
   choices: string[] | null;
   correctChoice: number | null;
   tags: string[];
   imageMediaId: string | null;
   audioMediaId: string | null;
}>;

export const CARD_TYPE_OPTIONS: Array<{ value: CardType; label: string }> = [
   { value: 'term_definition', label: 'Term / definition' },
   { value: 'cloze', label: 'Cloze (fill in the blank)' },
   { value: 'multiple_choice', label: 'Multiple choice' },
   { value: 'typed', label: 'Typed answer' },
   { value: 'image_prompt', label: 'Image prompt' },
];

function validate(
   type: CardType,
   front: string,
   back: string,
   clozeText: string,
   choices: string[],
   imageId?: string,
): string | null {
   if (type === 'cloze') {
      if (!clozeText.trim()) return 'Cloze text is required.';
      return null;
   }
   if (!front.trim()) return 'Front is required.';
   if ((type === 'term_definition' || type === 'typed') && !back.trim()) return 'Back is required.';
   if (type === 'multiple_choice') {
      const filled = choices.map((choice) => choice.trim()).filter(Boolean);
      if (filled.length < 2) return 'Provide at least two choices.';
   }
   if (type === 'image_prompt' && !imageId) return 'Upload an image for this card.';
   return null;
}

export function CardForm({
   initial,
   deckId,
   typeLocked = false,
   submitLabel = 'Save',
   busy = false,
   onSubmit,
}: {
   initial?: InitialCard;
   deckId?: string;
   typeLocked?: boolean;
   submitLabel?: string;
   busy?: boolean;
   onSubmit: (draft: CardDraft) => void;
}) {
   const [type, setType] = useState<CardType>(initial?.type ?? 'term_definition');
   const [front, setFront] = useState(initial?.front ?? '');
   const [back, setBack] = useState(initial?.back ?? '');
   const [clozeText, setClozeText] = useState(initial?.clozeText ?? '');
   const [choices, setChoices] = useState<string[]>(initial?.choices ?? ['', '']);
   const [correctChoice, setCorrectChoice] = useState(initial?.correctChoice ?? 0);
   const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
   const [imageMediaId, setImageMediaId] = useState<string | undefined>(
      initial?.imageMediaId ?? undefined,
   );
   const [audioMediaId, setAudioMediaId] = useState<string | undefined>(
      initial?.audioMediaId ?? undefined,
   );
   const [error, setError] = useState<string | null>(null);

   function submit(event: Event) {
      event.preventDefault();
      const problem = validate(type, front, back, clozeText, choices, imageMediaId);
      if (problem) {
         setError(problem);
         return;
      }
      setError(null);

      const draft: CardDraft = {
         type,
         front: type === 'cloze' ? clozeText : front,
         tags,
         imageMediaId,
         audioMediaId,
      };
      if (type === 'term_definition' || type === 'typed' || type === 'image_prompt')
         draft.back = back;
      if (type === 'cloze') draft.clozeText = clozeText;
      if (type === 'multiple_choice') {
         draft.choices = choices.map((choice) => choice.trim()).filter(Boolean);
         draft.correctChoice = correctChoice;
      }
      onSubmit(draft);
   }

   return (
      <form
         className='flex flex-col gap-3'
         onSubmit={submit}
      >
         <div className='flex flex-col gap-1.5'>
            <Label htmlFor='card-type'>Type</Label>
            <Select
               id='card-type'
               value={type}
               disabled={typeLocked}
               onValueChange={(value) => setType(value as CardType)}
               items={CARD_TYPE_OPTIONS}
            />
         </div>

         {type === 'cloze' ? (
            <div className='flex flex-col gap-1.5'>
               <Label htmlFor='cloze-text'>Cloze text</Label>
               <Textarea
                  id='cloze-text'
                  value={clozeText}
                  onInput={(event) => setClozeText((event.target as HTMLTextAreaElement).value)}
                  placeholder='The capital of France is {{Paris}}.'
               />
               <p className='text-xs text-muted-foreground'>
                  Wrap hidden tokens in double braces: {'{{like this}}'}.
               </p>
            </div>
         ) : (
            <div className='flex flex-col gap-1.5'>
               <Label htmlFor='card-front'>
                  {type === 'image_prompt' ? 'Prompt / caption' : 'Front'}
               </Label>
               <Input
                  id='card-front'
                  value={front}
                  onInput={(event) => setFront((event.target as HTMLInputElement).value)}
               />
            </div>
         )}

         {(type === 'term_definition' || type === 'typed' || type === 'image_prompt') && (
            <div className='flex flex-col gap-1.5'>
               <Label htmlFor='card-back'>{type === 'image_prompt' ? 'Answer' : 'Back'}</Label>
               <MarkdownEditor
                  id='card-back'
                  value={back}
                  onChange={setBack}
                  placeholder='Write the definition. Markdown is supported.'
               />
            </div>
         )}

         {type === 'multiple_choice' && (
            <div className='flex flex-col gap-2'>
               <Label>Choices</Label>
               {choices.map((choice, index) => (
                  <div
                     key={index}
                     className='flex items-center gap-2'
                  >
                     <input
                        type='radio'
                        name='correct-choice'
                        checked={correctChoice === index}
                        onChange={() => setCorrectChoice(index)}
                        title='Mark as correct'
                     />
                     <Input
                        value={choice}
                        placeholder={`Choice ${index + 1}`}
                        onInput={(event) => {
                           const value = (event.target as HTMLInputElement).value;
                           setChoices((current) =>
                              current.map((item, itemIndex) =>
                                 itemIndex === index ? value : item,
                              ),
                           );
                        }}
                     />
                     {choices.length > 2 && (
                        <Button
                           type='button'
                           variant='ghost'
                           size='sm'
                           onClick={() =>
                              setChoices((current) =>
                                 current.filter((_, itemIndex) => itemIndex !== index),
                              )
                           }
                        >
                           Remove
                        </Button>
                     )}
                  </div>
               ))}
               {choices.length < 8 && (
                  <div>
                     <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        onClick={() => setChoices((current) => [...current, ''])}
                     >
                        Add choice
                     </Button>
                  </div>
               )}
            </div>
         )}

         <MediaPicker
            label={type === 'image_prompt' ? 'Image (required)' : 'Image (optional)'}
            kind='image'
            value={imageMediaId}
            onChange={setImageMediaId}
         />

         <MediaPicker
            label='Audio (optional)'
            kind='audio'
            value={audioMediaId}
            onChange={setAudioMediaId}
         />

         <div className='flex flex-col gap-1.5'>
            <Label htmlFor='card-tags'>Tags</Label>
            <TagsField
               value={tags}
               onChange={setTags}
               deckId={deckId}
            />
         </div>

         {error && (
            <Alert variant='destructive'>
               <AlertDescription>{error}</AlertDescription>
            </Alert>
         )}

         <div>
            <Button
               type='submit'
               size='sm'
               disabled={busy}
            >
               {submitLabel}
            </Button>
         </div>
      </form>
   );
}
