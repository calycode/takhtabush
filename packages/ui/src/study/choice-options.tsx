import { Kbd } from '#components/kbd';
import { cn } from '#lib/utils';

export type ChoiceOptionsProps = {
   options: string[];
   correctValue: string;
   picked: string | null;
   onPick: (option: string) => void;
   className?: string;
};

/**
 * Large, tappable multiple-choice grid with numbered key hints (SPEC §10.5, R5).
 * Shared by the web app and the MCP Apps widget.
 */
export function ChoiceOptions({
   options,
   correctValue,
   picked,
   onPick,
   className,
}: ChoiceOptionsProps) {
   const answered = picked !== null;
   return (
      <div className={cn('grid w-full gap-2 sm:grid-cols-2', className)}>
         {options.map((option, index) => {
            const isCorrect = option === correctValue;
            const isPicked = option === picked;
            return (
               <button
                  key={option}
                  type='button'
                  disabled={answered}
                  onClick={() => onPick(option)}
                  className={cn(
                     'relative flex min-h-14 items-center justify-center rounded-lg border px-4 py-3 text-sm font-medium transition-all duration-150 active:scale-[0.98] disabled:cursor-default',
                     answered && isCorrect
                        ? 'border-primary bg-primary/10'
                        : answered && isPicked
                          ? 'border-destructive bg-destructive/10'
                          : 'border-border hover:bg-muted disabled:opacity-60',
                  )}
               >
                  <span className='text-balance'>{option}</span>
                  <Kbd className='absolute top-2 right-2'>{index + 1}</Kbd>
               </button>
            );
         })}
      </div>
   );
}
