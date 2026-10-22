import { useEffect, useState } from 'react';
import type { ComponentChildren } from 'preact';
import { Button } from '@caly/ui/components/button';
import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
   DialogTrigger,
} from '@caly/ui/components/dialog';
import { Alert, AlertDescription } from '@caly/ui/components/alert';
import { cn } from '@caly/ui/lib/utils';
import type {
   MatchingVariant,
   StudyGoal,
   StudyMode,
   StudyOptions,
   StudyPreview,
} from '@caly/shared';
import { ApiError } from '../lib/api/client';
import { getStudyOptions } from '../lib/api/decks';
import { previewStudy } from '../lib/api/study';

export type StudyConfig = {
   mode: StudyMode;
   goal: StudyGoal;
   minutes: number;
   variant: MatchingVariant;
};

const LAST_KEY = 'takhtabush:lastSession';

const GOALS: Array<{ value: StudyGoal; label: string }> = [
   { value: 'cram', label: 'Revise now' },
   { value: 'learn', label: 'Learn new' },
   { value: 'review', label: 'Review due' },
   { value: 'retain', label: 'Retain' },
   { value: 'diagnose', label: 'Diagnose weak spots' },
];

const MODE_LABELS: Record<StudyMode, string> = {
   flashcards: 'Flashcards',
   multiple_choice: 'Multiple choice',
   typed: 'Typed answer',
   cloze: 'Fill in the blank',
   matching: 'Matching',
   mixed: 'Mixed',
};

const MODES: StudyMode[] = ['flashcards', 'multiple_choice', 'typed', 'cloze', 'matching', 'mixed'];

const TIMES = [5, 10, 15, 30];

function readLast(): StudyConfig | null {
   try {
      const raw = localStorage.getItem(LAST_KEY);
      return raw ? (JSON.parse(raw) as StudyConfig) : null;
   } catch {
      return null;
   }
}

function Chips<T extends string>({
   value,
   options,
   onChange,
}: {
   value: T;
   options: Array<{ value: T; label: string; disabled?: boolean; hint?: string }>;
   onChange: (value: T) => void;
}) {
   return (
      <div className='flex flex-wrap gap-2'>
         {options.map((option) => (
            <button
               key={option.value}
               type='button'
               disabled={option.disabled}
               title={option.hint}
               onClick={() => onChange(option.value)}
               className={cn(
                  'rounded-full border px-3 py-1 text-xs transition-all duration-150 active:scale-95',
                  value === option.value
                     ? 'border-primary bg-primary text-primary-foreground'
                     : 'border-border hover:bg-muted',
                  option.disabled && 'cursor-not-allowed opacity-40',
               )}
            >
               {option.label}
            </button>
         ))}
      </div>
   );
}

function Section({
   index,
   title,
   hint,
   done,
   children,
}: {
   index: number;
   title: string;
   hint: string;
   done: boolean;
   children: ComponentChildren;
}) {
   return (
      <li className='flex gap-3'>
         <span
            className={cn(
               'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-all duration-200',
               done
                  ? 'scale-105 bg-primary text-primary-foreground'
                  : 'border border-input text-muted-foreground',
            )}
         >
            {done ? '✓' : index}
         </span>
         <div className='flex flex-1 flex-col gap-2'>
            <div className='flex flex-col'>
               <span className='text-sm font-medium'>{title}</span>
               <span className='text-xs text-muted-foreground'>{hint}</span>
            </div>
            {children}
         </div>
      </li>
   );
}

export function StudyLauncher({
   deckId,
   onStart,
   triggerDisabled,
}: {
   deckId: string;
   onStart: (config: StudyConfig) => void;
   triggerDisabled?: boolean;
}) {
   const [open, setOpen] = useState(false);
   const [options, setOptions] = useState<StudyOptions | null>(null);
   const [optionsError, setOptionsError] = useState<string | null>(null);
   const [goal, setGoal] = useState<StudyGoal>('cram');
   const [mode, setMode] = useState<StudyMode>('flashcards');
   const [minutes, setMinutes] = useState(10);
   const [variant, setVariant] = useState<MatchingVariant>('pairs');
   const [preview, setPreview] = useState<StudyPreview | null>(null);
   const [last, setLast] = useState<StudyConfig | null>(readLast);
   const [touched, setTouched] = useState({ goal: false, mode: false, time: false });

   useEffect(() => {
      if (!open || options) return;
      getStudyOptions(deckId)
         .then((result) => {
            setOptions(result.data);
            if (!result.data.availableModes.includes('flashcards')) {
               setMode(result.data.availableModes[0] ?? 'flashcards');
            }
         })
         .catch((cause) =>
            setOptionsError(cause instanceof ApiError ? cause.message : 'Failed to load options'),
         );
   }, [open, options, deckId]);

   useEffect(() => {
      if (!open) return;
      let active = true;
      previewStudy({ deckId, mode, goal, minutes })
         .then((result) => {
            if (active) setPreview(result.data);
         })
         .catch(() => {
            if (active) setPreview(null);
         });
      return () => {
         active = false;
      };
   }, [open, deckId, mode, goal, minutes]);

   function start(config: StudyConfig) {
      localStorage.setItem(LAST_KEY, JSON.stringify(config));
      setLast(config);
      setOpen(false);
      onStart(config);
   }

   const available = options?.availableModes ?? [];
   const canStart = Boolean(preview && preview.cardCount > 0);

   return (
      <Dialog
         open={open}
         onOpenChange={setOpen}
      >
         <DialogTrigger render={<Button disabled={triggerDisabled} />}>Study</DialogTrigger>
         <DialogContent className='max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain sm:max-w-lg'>
            <DialogHeader>
               <DialogTitle>Start a study session</DialogTitle>
               <DialogDescription>
                  {options
                     ? `${options.cardCount} cards · ${options.dueCount} due · ${options.newCount} new`
                     : 'Loading your deck…'}
               </DialogDescription>
            </DialogHeader>

            {optionsError && (
               <Alert variant='destructive'>
                  <AlertDescription>{optionsError}</AlertDescription>
               </Alert>
            )}

            {last && (
               <Button
                  variant='outline'
                  size='sm'
                  className='self-start'
                  onClick={() => start(last)}
               >
                  Repeat last: {MODE_LABELS[last.mode]} · {last.minutes}m
               </Button>
            )}

            <ol className='flex flex-col gap-4 py-1'>
               <Section
                  index={1}
                  title='Goal'
                  hint='What you want out of this session — “Revise now” always covers the whole set, whatever the schedule.'
                  done={touched.goal}
               >
                  <Chips
                     value={goal}
                     onChange={(value) => {
                        setGoal(value);
                        setTouched((current) => ({ ...current, goal: true }));
                     }}
                     options={GOALS}
                  />
               </Section>

               <Section
                  index={2}
                  title='Practice style'
                  hint='How cards are shown. Styles that need card types this deck lacks are disabled.'
                  done={touched.mode}
               >
                  <Chips
                     value={mode}
                     onChange={(value) => {
                        setMode(value);
                        setTouched((current) => ({ ...current, mode: true }));
                     }}
                     options={MODES.map((value) => ({
                        value,
                        label: MODE_LABELS[value],
                        disabled: !available.includes(value),
                        hint: available.includes(value)
                           ? undefined
                           : 'No matching cards in this deck',
                     }))}
                  />
                  {mode === 'matching' && (
                     <div className='mt-1 flex flex-col gap-2 rounded-lg border bg-muted/30 p-3'>
                        <span className='text-xs font-medium'>
                           Matching style
                           <span className='text-muted-foreground'> · choose one</span>
                        </span>
                        <Chips
                           value={variant}
                           onChange={setVariant}
                           options={[
                              { value: 'pairs', label: 'Pairs (two columns)' },
                              { value: 'choice', label: 'Pick from options' },
                           ]}
                        />
                     </div>
                  )}
               </Section>

               <Section
                  index={3}
                  title='Time'
                  hint='Roughly how long you want to study for.'
                  done={touched.time}
               >
                  <Chips
                     value={String(minutes)}
                     onChange={(value) => {
                        setMinutes(Number(value));
                        setTouched((current) => ({ ...current, time: true }));
                     }}
                     options={TIMES.map((value) => ({
                        value: String(value),
                        label: `${value} min`,
                     }))}
                  />
               </Section>
            </ol>

            <Alert variant={canStart ? 'info' : 'destructive'}>
               <AlertDescription>
                  {canStart && preview
                     ? `This session: about ${preview.cardCount} cards · ~${preview.estimatedMinutes} min`
                     : 'Nothing to study with this setup.'}
               </AlertDescription>
            </Alert>

            <DialogFooter>
               <Button
                  size='sm'
                  disabled={!canStart}
                  onClick={() => start({ mode, goal, minutes, variant })}
               >
                  Start
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
   );
}
