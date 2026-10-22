import type { ComponentChildren } from 'preact';

import { Badge } from '#components/badge';
import { CardContent } from '#components/card';

import { Markdown } from '../markdown/markdown';

export type StudyCardShellProps = {
   /** The prompt text; callers pre-mask cloze sentences. */
   prompt: string;
   /** The answer text as raw markdown, shown only once `revealed`. */
   answer?: string | null;
   revealed: boolean;
   type?: string | null;
   showType?: boolean;
   imageUrl?: string | null;
   audioUrl?: string | null;
   /** Slot between the prompt and the interaction body (e.g. a Reveal button). */
   action?: ComponentChildren;
   /** Interaction body (choice grid, typed input, result line). */
   children?: ComponentChildren;
};

/**
 * Presentational shell for one study card (SPEC §10.5). Shared by the web app
 * and the MCP Apps widget so the two surfaces stay visually identical.
 */
export function StudyCardShell({
   prompt,
   answer,
   revealed,
   type,
   showType = true,
   imageUrl,
   audioUrl,
   action,
   children,
}: StudyCardShellProps) {
   return (
      <CardContent className='flex min-h-56 min-w-0 flex-col items-center justify-center gap-5 px-4 py-6 text-center sm:py-10'>
         {showType && type && type !== 'term_definition' && <Badge variant='outline'>{type}</Badge>}

         {imageUrl && (
            <img
               src={imageUrl}
               alt='Card'
               className='max-h-48 max-w-full rounded-md border object-contain'
            />
         )}
         {audioUrl && (
            <audio
               controls
               src={audioUrl}
               className='max-w-full'
            />
         )}

         <div className='flex w-full min-w-0 flex-col items-center gap-1'>
            <span className='text-[0.625rem] tracking-wide text-muted-foreground uppercase'>
               Prompt
            </span>
            <p className='max-w-full text-lg font-medium text-balance wrap-anywhere sm:text-xl'>
               {prompt}
            </p>
         </div>

         {action}

         {children}

         {revealed && (
            <div className='flex w-full min-w-0 flex-col items-center gap-1 border-t pt-4'>
               <span className='text-[0.625rem] tracking-wide text-muted-foreground uppercase'>
                  Answer
               </span>
               {answer ? (
                  <Markdown
                     source={answer}
                     className='w-full min-w-0 text-center text-lg font-medium text-balance wrap-anywhere sm:text-xl'
                  />
               ) : (
                  <p className='text-lg font-medium text-balance wrap-anywhere sm:text-xl'>—</p>
               )}
            </div>
         )}
      </CardContent>
   );
}
