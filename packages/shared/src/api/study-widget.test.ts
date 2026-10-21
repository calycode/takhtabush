import { describe, expect, it } from 'vitest';
import { MCP_STUDY_WIDGET_RESOURCE_URI, studySessionSnapshotSchema } from './study-widget';

const snapshot = {
   sessionId: 'stu_1',
   deckId: 'deck_1',
   deckTitle: 'Spanish A1',
   mode: 'flashcards',
   status: 'active',
   total: 1,
   reviewed: 0,
   reviewedCardIds: [],
   cards: [
      {
         id: 'card_1',
         type: 'term_definition',
         front: 'hola',
         back: 'hello',
         clozeText: null,
         choices: null,
         correctChoice: null,
         imageUrl: null,
         audioUrl: null,
      },
   ],
   fallbackStudyPath: '/study/stu_1',
};

describe('study session snapshot (R6)', () => {
   it('parses a valid snapshot', () => {
      expect(studySessionSnapshotSchema.parse(snapshot).sessionId).toBe('stu_1');
   });

   it('rejects a snapshot without a session id', () => {
      expect(() =>
         studySessionSnapshotSchema.parse({ ...snapshot, sessionId: undefined }),
      ).toThrow();
   });

   it('exposes a versioned MCP Apps resource URI', () => {
      expect(MCP_STUDY_WIDGET_RESOURCE_URI).toBe('ui://takhtabush/study-session/v1.html');
   });
});
