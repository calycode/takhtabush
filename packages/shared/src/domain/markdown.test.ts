import { describe, expect, it } from 'vitest';
import { markdownToText, parseMarkdown, sanitizeHref } from './markdown';

describe('markdown', () => {
   it('parses paragraphs with inline emphasis, code, and links', () => {
      expect(
         parseMarkdown('The **capital** of *France* is `Paris` [map](https://x.test).'),
      ).toEqual([
         {
            type: 'paragraph',
            children: [
               { type: 'text', value: 'The ' },
               { type: 'strong', children: [{ type: 'text', value: 'capital' }] },
               { type: 'text', value: ' of ' },
               { type: 'em', children: [{ type: 'text', value: 'France' }] },
               { type: 'text', value: ' is ' },
               { type: 'code', value: 'Paris' },
               { type: 'text', value: ' ' },
               {
                  type: 'link',
                  href: 'https://x.test',
                  children: [{ type: 'text', value: 'map' }],
               },
               { type: 'text', value: '.' },
            ],
         },
      ]);
   });

   it('parses headings, lists, quotes, and code fences', () => {
      const blocks = parseMarkdown(
         [
            '## Notes',
            '',
            '- one',
            '- two',
            '',
            '> quoted',
            '',
            '```ts',
            'const x = 1;',
            '```',
         ].join('\n'),
      );
      expect(blocks.map((block) => block.type)).toEqual([
         'heading',
         'list',
         'blockquote',
         'codeBlock',
      ]);
      const list = blocks[1];
      expect(list.type === 'list' && list.items).toHaveLength(2);
   });

   it('leaves intraword underscores and stray markers as text', () => {
      expect(parseMarkdown('snake_case and 5 * 3')).toEqual([
         {
            type: 'paragraph',
            children: [{ type: 'text', value: 'snake_case and 5 * 3' }],
         },
      ]);
   });

   it('drops links with scriptable schemes', () => {
      expect(parseMarkdown('[x](javascript:alert(1))')).toEqual([
         {
            type: 'paragraph',
            children: [{ type: 'text', value: '[x](javascript:alert(1))' }],
         },
      ]);
      expect(sanitizeHref(' javascript:alert(1) ')).toBeNull();
      expect(sanitizeHref('https://example.test')).toBe('https://example.test');
   });

   it('flattens markdown to plain text', () => {
      expect(markdownToText('# Title\n\nThe **capital** is `Paris`.\n\n- a\n- b')).toBe(
         'Title The capital is Paris. a b',
      );
      expect(markdownToText('plain')).toBe('plain');
   });
});
