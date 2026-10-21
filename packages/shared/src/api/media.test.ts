import { describe, expect, it } from 'vitest';
import { MAX_AUDIO_BYTES, MAX_IMAGE_BYTES, isAllowedMime, isAudioMime, maxBytesFor } from './media';
import { decodeCursor, encodeCursor } from './common';

describe('media limits', () => {
   it('maps mime types to their size caps', () => {
      expect(maxBytesFor('image/png')).toBe(MAX_IMAGE_BYTES);
      expect(maxBytesFor('audio/mpeg')).toBe(MAX_AUDIO_BYTES);
      expect(maxBytesFor('application/pdf')).toBeNull();
   });

   it('classifies mime types', () => {
      expect(isAllowedMime('image/webp')).toBe(true);
      expect(isAllowedMime('text/plain')).toBe(false);
      expect(isAudioMime('audio/webm')).toBe(true);
      expect(isAudioMime('image/gif')).toBe(false);
   });
});

describe('cursor', () => {
   it('round-trips updatedAt and id', () => {
      const cursor = encodeCursor('2026-01-01T00:00:00.000Z', 'deck_1');
      expect(decodeCursor(cursor)).toEqual({ updatedAt: '2026-01-01T00:00:00.000Z', id: 'deck_1' });
   });

   it('returns null for a malformed cursor', () => {
      expect(decodeCursor('nope')).toBeNull();
   });
});
