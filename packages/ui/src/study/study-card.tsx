import { useEffect, useMemo, useRef, useState } from 'react';
import {
   checkAnswer,
   checkCloze,
   cardAnswer,
   choiceOptionsFor,
   gradeFromPerformance,
   interactionFor,
   markdownToText,
   maskCloze,
   type ReviewResponse,
   type StudyCardData,
   type StudyMode,
} from '@caly/shared';

import { Button } from '#components/button';
import { Card as UICard } from '#components/card';

import { ChoiceOptions } from './choice-options';
import { GradeBar, STUDY_GRADES, type StudyGrade } from './grade-bar';
import { StudyCardShell } from './study-card-shell';

export type StudyCardProps = {
   card: StudyCardData;
   mode: StudyMode;
   pool: StudyCardData[];
   busy: boolean;
   onAnswered: (response: ReviewResponse) => void;
};

/**
 * One interactive study card (SPEC §10.5). Shared by the web app and the MCP
 * Apps widget so keyboard, feedback, and grading behaviour stay identical.
 */
export function StudyCard({ card, mode, pool, busy, onAnswered }: StudyCardProps) {
   const interaction = interactionFor(card, mode);
   const [revealed, setRevealed] = useState(false);
   const [picked, setPicked] = useState<string | null>(null);
   const [text, setText] = useState('');
   const [result, setResult] = useState<'correct' | 'incorrect' | null>(null);
   const [grade, setGrade] = useState<ReviewResponse | null>(null);
   const timer = useRef<number>();
   const startedAt = useRef(Date.now());
   const inputRef = useRef<HTMLInputElement>(null);

   const clozeSentence = card.clozeText ?? card.front;

   const correctValue = useMemo(() => cardAnswer(card), [card]);

   const options = useMemo(
      () => (interaction === 'choice' ? choiceOptionsFor(card, pool) : []),
      [interaction, card, pool],
   );

   function answer(response: ReviewResponse) {
      if (!busy) onAnswered(response);
   }

   function afterCheck(correct: boolean) {
      const response = gradeFromPerformance({
         correct,
         durationMs: Date.now() - startedAt.current,
         attempts: 1,
      });
      setGrade(response);
      setResult(correct ? 'correct' : 'incorrect');
      timer.current = window.setTimeout(() => answer(response), 700);
   }

   function chooseOption(option: string) {
      if (picked !== null) return;
      setPicked(option);
      afterCheck(option === correctValue);
   }

   useEffect(() => {
      return () => {
         if (timer.current) clearTimeout(timer.current);
      };
   }, []);

   // Keep the text input focused whenever a new card is shown (SPEC §10.5).
   useEffect(() => {
      if (interaction === 'typed' || interaction === 'cloze') inputRef.current?.focus();
   }, [interaction]);

   useEffect(() => {
      function onKey(event: KeyboardEvent) {
         if (interaction === 'flashcards') {
            if (event.code === 'Space') {
               event.preventDefault();
               setRevealed(true);
               return;
            }
            if (!revealed) return;
            const match = STUDY_GRADES.find((item) => item.key === event.key);
            if (match) answer(match.response);
            return;
         }
         if (interaction === 'choice' && picked === null) {
            const index = Number(event.key) - 1;
            if (Number.isInteger(index) && index >= 0 && index < options.length) {
               event.preventDefault();
               chooseOption(options[index]);
            }
         }
      }
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
   });
   const answerText =
      interaction === 'cloze'
         ? clozeSentence.replace(/\{\{(.+?)\}\}/g, '$1')
         : markdownToText(card.back ?? '—');
   return (
      <UICard className='animate-in fade-in slide-in-from-bottom-2 duration-200'>
         <StudyCardShell
            prompt={interaction === 'cloze' ? maskCloze(clozeSentence) : card.front}
            answer={card.back}
            revealed={interaction === 'flashcards' && revealed}
            type={card.type}
            imageUrl={card.imageUrl}
            audioUrl={card.audioUrl}
            action={
               interaction === 'flashcards' && !revealed ? (
                  <Button
                     variant='outline'
                     size='sm'
                     onClick={() => setRevealed(true)}
                  >
                     Reveal answer
                  </Button>
               ) : null
            }
         >
            {interaction === 'choice' && (
               <ChoiceOptions
                  options={options}
                  correctValue={correctValue}
                  picked={picked}
                  onPick={chooseOption}
               />
            )}

            {(interaction === 'typed' || interaction === 'cloze') && (
               <form
                  className='flex w-full max-w-md min-w-0 flex-col items-center gap-2'
                  onSubmit={(event) => {
                     event.preventDefault();
                     if (result) return;
                     const correct =
                        interaction === 'cloze'
                           ? checkCloze(clozeSentence, text)
                           : checkAnswer(markdownToText(card.back ?? ''), text);
                     afterCheck(correct);
                  }}
               >
                  <input
                     ref={inputRef}
                     value={text}
                     disabled={result !== null}
                     placeholder='Your answer'
                     className='h-11 w-full rounded-md border border-input bg-transparent px-3 text-center text-base outline-none transition-all focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50'
                     onInput={(event) => setText((event.target as HTMLInputElement).value)}
                  />
                  {result === null && (
                     <Button
                        type='submit'
                        size='sm'
                     >
                        Check
                     </Button>
                  )}
                  {result === 'incorrect' && (
                     <p className='max-w-full text-sm wrap-anywhere'>
                        Correct: <span className='font-medium'>{answerText}</span>
                     </p>
                  )}
               </form>
            )}

            {result && (
               <p
                  className={
                     result === 'correct' ? 'text-sm text-primary' : 'text-sm text-destructive'
                  }
               >
                  {result === 'correct' ? 'Correct' : 'Incorrect'}
                  {grade ? ` · ${grade}` : ''}
               </p>
            )}
         </StudyCardShell>

         {interaction === 'flashcards' && revealed && (
            <GradeBar
               onGrade={(response: StudyGrade) => answer(response)}
               disabled={busy}
            />
         )}
      </UICard>
   );
}
