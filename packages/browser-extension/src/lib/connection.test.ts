import { describe, expect, it } from 'vitest';
import { normalizeOrigin, permissionPattern } from './url';

describe('normalizeOrigin', () => {
   it('adds https and strips paths, queries, and hashes', () => {
      expect(normalizeOrigin('cards.example.com/some/path?x=1#top')).toBe(
         'https://cards.example.com',
      );
   });

   it('keeps localhost ports for development', () => {
      expect(normalizeOrigin('http://localhost:5173/some/path')).toBe('http://localhost:5173');
   });

   it('rejects plain http outside localhost', () => {
      expect(() => normalizeOrigin('http://cards.example.com')).toThrow(/HTTPS/);
   });

   it('rejects empty input', () => {
      expect(() => normalizeOrigin('   ')).toThrow(/URL/);
   });
});

describe('permissionPattern', () => {
   it('drops the port because Chrome match patterns already cover every port', () => {
      expect(permissionPattern('http://localhost:5173')).toBe('http://localhost/*');
      expect(permissionPattern('https://cards.example.com')).toBe('https://cards.example.com/*');
   });
});
