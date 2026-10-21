import { describe, expect, it } from 'vitest';
import { parseImportContent } from '@caly/shared';

describe('import parsing', () => {
   it('parses CSV with a header row', () => {
      const result = parseImportContent('csv', 'front,back,tags\na,b,x;y\nc,d,', true);
      expect(result.rows).toEqual([
         { front: 'a', back: 'b', tags: ['x', 'y'] },
         { front: 'c', back: 'd', tags: [] },
      ]);
      expect(result.errors).toHaveLength(0);
   });

   it('parses TSV without a header', () => {
      const result = parseImportContent('tsv', 'a\tb\nc\td', false);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]).toEqual({ front: 'a', back: 'b', tags: [] });
   });

   it('handles quoted delimiters', () => {
      const result = parseImportContent('csv', '"a,1","b,2"', false);
      expect(result.rows[0].front).toBe('a,1');
      expect(result.rows[0].back).toBe('b,2');
   });

   it('reports malformed rows without throwing', () => {
      const result = parseImportContent('csv', ',b\nc,d', false);
      expect(result.errors[0]).toEqual({ row: 1, message: 'Missing front field' });
      expect(result.rows).toHaveLength(1);
   });

   it('parses JSON arrays and rejects non-arrays', () => {
      const result = parseImportContent('json', '[{"front":"a","back":"b","tags":["t"]}]', false);
      expect(result.rows[0]).toEqual({ front: 'a', back: 'b', tags: ['t'] });
      expect(() => parseImportContent('json', '{}', false)).toThrow();
      expect(() => parseImportContent('json', 'not json', false)).toThrow();
   });

   it('keeps semicolons inside a tag when the separator is a comma', () => {
      const result = parseImportContent('csv', 'a,b,x;y;z', false, { tagSeparator: ',' });
      expect(result.rows[0].tags).toEqual(['x;y;z']);
   });

   it('keeps the tags field whole when the separator is none', () => {
      const result = parseImportContent('csv', 'a,b,c;d', false, { tagSeparator: 'none' });
      expect(result.rows[0].tags).toEqual(['c;d']);
   });

   it('honours an explicit column delimiter with a comma tag separator', () => {
      const result = parseImportContent('csv', 'a;b;x,y', false, {
         delimiter: ';',
         tagSeparator: ',',
      });
      expect(result.rows[0]).toEqual({ front: 'a', back: 'b', tags: ['x', 'y'] });
   });

   it('auto-detects the column delimiter', () => {
      const result = parseImportContent('csv', 'a;b\nc;d', false, { delimiter: 'auto' });
      expect(result.rows).toEqual([
         { front: 'a', back: 'b', tags: [] },
         { front: 'c', back: 'd', tags: [] },
      ]);
   });
});
