import { Button } from '#components/button';
import { Kbd } from '#components/kbd';

export const STUDY_GRADES = [
   { response: 'again', label: 'Again', key: '1' },
   { response: 'hard', label: 'Hard', key: '2' },
   { response: 'good', label: 'Good', key: '3' },
   { response: 'easy', label: 'Easy', key: '4' },
] as const;

export type StudyGrade = (typeof STUDY_GRADES)[number]['response'];

/**
 * The four response buttons with key hints (SPEC §7.1). Shared by the web app
 * and the MCP Apps widget.
 */
export function GradeBar({
   onGrade,
   disabled,
}: {
   onGrade: (response: StudyGrade) => void;
   disabled?: boolean;
}) {
   return (
      <div className='grid grid-cols-4 gap-2 px-4 pb-4'>
         {STUDY_GRADES.map((item) => (
            <Button
               key={item.response}
               variant={item.response === 'again' ? 'destructive' : 'outline'}
               disabled={disabled}
               onClick={() => onGrade(item.response)}
            >
               {item.label}
               <Kbd className='ml-1'>{item.key}</Kbd>
            </Button>
         ))}
      </div>
   );
}
