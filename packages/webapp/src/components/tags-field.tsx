import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@caly/ui/components/badge';
import { cn } from '@caly/ui/lib/utils';
import { listTags } from '../lib/api/tags';

const MAX_TAGS = 20;
const tagCache = new Map<string, string[]>();

/**
 * Tag combobox: type to search tags already used in this deck (or the whole
 * account when no deck is known), or press Enter to add a new one. The API
 * call is deck-scoped so it stays bounded by the deck's card cap.
 */
export function TagsField({
   value,
   onChange,
   deckId,
}: {
   value: string[];
   onChange: (tags: string[]) => void;
   deckId?: string;
}) {
   const cacheKey = deckId ?? '*';
   const [all, setAll] = useState<string[]>(tagCache.get(cacheKey) ?? []);
   const [query, setQuery] = useState('');
   const [focused, setFocused] = useState(false);

   useEffect(() => {
      const cached = tagCache.get(cacheKey);
      if (cached) {
         setAll(cached);
         return;
      }
      listTags(deckId)
         .then((result) => {
            const names = result.data.map((tag) => tag.name);
            tagCache.set(cacheKey, names);
            setAll(names);
         })
         .catch(() => undefined);
   }, [cacheKey, deckId]);

   const selected = useMemo(() => new Set(value), [value]);
   const matches = useMemo(() => {
      const q = query.trim().toLowerCase();
      return all
         .filter((tag) => !selected.has(tag) && (q === '' || tag.toLowerCase().includes(q)))
         .slice(0, 8);
   }, [all, selected, query]);

   function add(raw: string) {
      const tag = raw.trim();
      if (!tag || selected.has(tag) || value.length >= MAX_TAGS) return;
      const existing = all.find((candidate) => candidate.toLowerCase() === tag.toLowerCase());
      onChange([...value, existing ?? tag]);
      setQuery('');
   }

   function remove(tag: string) {
      onChange(value.filter((item) => item !== tag));
   }

   return (
      <div className='relative flex flex-col gap-1.5'>
         <div className='flex min-h-8 flex-wrap items-center gap-1 rounded-md border border-input px-1.5 py-1 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30'>
            {value.map((tag) => (
               <Badge
                  key={tag}
                  variant='secondary'
                  className='gap-1'
               >
                  {tag}
                  <button
                     type='button'
                     aria-label={`Remove ${tag}`}
                     onClick={() => remove(tag)}
                     className='text-muted-foreground hover:text-foreground'
                  >
                     ×
                  </button>
               </Badge>
            ))}
            <input
               id='card-tags'
               value={query}
               placeholder={value.length === 0 ? 'Search or add a tag…' : ''}
               className='min-w-24 flex-1 bg-transparent px-1 text-xs outline-none'
               onFocus={() => setFocused(true)}
               onBlur={() => window.setTimeout(() => setFocused(false), 120)}
               onInput={(event) => setQuery((event.target as HTMLInputElement).value)}
               onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ',') {
                     event.preventDefault();
                     add(matches[0] && query.trim() === '' ? matches[0] : query);
                  } else if (event.key === 'Backspace' && query === '' && value.length > 0) {
                     remove(value[value.length - 1]);
                  }
               }}
            />
         </div>

         {focused && matches.length > 0 && (
            <div className='absolute top-full z-50 mt-1 flex w-full flex-wrap gap-1 rounded-md border bg-popover p-2 shadow-md'>
               {matches.map((tag) => (
                  <button
                     key={tag}
                     type='button'
                     onMouseDown={(event) => event.preventDefault()}
                     onClick={() => add(tag)}
                     className={cn('rounded-full border px-2 py-0.5 text-xs hover:bg-muted')}
                  >
                     {tag}
                  </button>
               ))}
            </div>
         )}
      </div>
   );
}
