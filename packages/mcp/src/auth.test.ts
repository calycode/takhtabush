import { describe, expect, it } from 'vitest';
import { resolveScopes } from './auth';

describe('resolveScopes', () => {
   it('returns the granted scopes when no header is present', () => {
      expect(resolveScopes(null, ['decks:read', 'stats:read'])).toEqual([
         'decks:read',
         'stats:read',
      ]);
   });

   it('narrows to the intersection of granted and requested', () => {
      expect(resolveScopes('decks:read,study:write', ['decks:read', 'stats:read'])).toEqual([
         'decks:read',
      ]);
   });

   it('returns no scopes when the header has no valid scopes', () => {
      expect(resolveScopes('bogus,  ', ['decks:read'])).toEqual([]);
   });

   it('keeps valid scopes when the header mixes valid and invalid values', () => {
      expect(resolveScopes('bogus,decks:read', ['decks:read', 'stats:read'])).toEqual([
         'decks:read',
      ]);
   });
});
