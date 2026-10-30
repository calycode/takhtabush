import { describe, expect, it } from 'vitest';
import type { User } from '@caly/shared';
import type { AppEnv } from '../env';
import { buildMcpServices } from './mcp-services';
import { FakeD1, fakeEnv } from '../test/fake-d1';

const OWNER = 'usr_snapshot_test';
const SESSION = 'stu_snapshot_test';
const DECK = 'deck_snapshot_test';
const NOW = '2026-10-30T00:00:00.000Z';

const user: User = {
   id: OWNER,
   email: `${OWNER}@example.test`,
   displayName: 'Snapshot tester',
   isOwner: true,
   createdAt: NOW,
   updatedAt: NOW,
};

function cardRow(id: string) {
   return {
      id,
      deck_id: DECK,
      owner_id: OWNER,
      type: 'term_definition',
      front: `front ${id}`,
      back: `back ${id}`,
      cloze_text: null,
      choices_json: null,
      correct_choice: null,
      image_media_id: null,
      audio_media_id: null,
      tags_json: '[]',
      status: 'active',
      source: 'manual',
      created_at: NOW,
      updated_at: NOW,
      deleted_at: null,
   };
}

function db(plannedIds: string[]): FakeD1 {
   return new FakeD1([
      {
         match: /^SELECT \* FROM study_sessions WHERE id = \?/,
         respond: () => ({
            first: {
               id: SESSION,
               user_id: OWNER,
               deck_id: DECK,
               mode: 'flashcards',
               strategy: 'mixed',
               planned_card_ids_json: JSON.stringify(plannedIds),
               status: 'active',
               started_at: NOW,
               completed_at: null,
               created_by: 'mcp',
            },
         }),
      },
      {
         match: /^SELECT \* FROM decks WHERE id = \?/,
         respond: () => ({
            first: {
               id: DECK,
               owner_id: OWNER,
               title: 'Snapshot deck',
               description: null,
               collection_id: null,
               visibility: 'private',
               card_count: plannedIds.length,
               created_at: NOW,
               updated_at: NOW,
               deleted_at: null,
            },
         }),
      },
      {
         match: /^SELECT DISTINCT card_id FROM review_events WHERE session_id = \?/,
         respond: () => ({ all: [] }),
      },
      {
         match: /^SELECT \* FROM cards[\s\S]*id IN \(/,
         respond: (params) => ({ all: params.slice(1).map((id) => cardRow(String(id))) }),
      },
   ]);
}

function env(fake: FakeD1): AppEnv {
   return fakeEnv(fake) as unknown as AppEnv;
}

describe('MCP study-session snapshot', () => {
   it('reads a 300-card snapshot with a fixed number of statements', async () => {
      const planned = Array.from(
         { length: 300 },
         (_, index) => `card_snapshot_${String(index).padStart(4, '0')}`,
      );
      const fake = db(planned);
      const services = buildMcpServices(env(fake), user, null, 'http://localhost:8787');

      const snapshot = await services.getStudySession(SESSION);

      expect(snapshot).not.toBeNull();
      expect(snapshot?.cards).toHaveLength(300);
      // session + deck + reviewed ids + ceil(300 / 90) card chunks = 7.
      expect(fake.statements).toHaveLength(7);
      expect(fake.count(/^SELECT \* FROM cards[\s\S]*id IN \(/)).toBe(4);
      // The old implementation issued one single-card query per planned card.
      expect(fake.has(/^SELECT \* FROM cards WHERE id = \?/)).toBe(false);
   });

   it('keeps the statement count independent of a five-card session', async () => {
      const fake = db(['card_a', 'card_b', 'card_c', 'card_d', 'card_e']);
      const services = buildMcpServices(env(fake), user, null, 'http://localhost:8787');

      const snapshot = await services.getStudySession(SESSION);

      expect(snapshot?.cards).toHaveLength(5);
      expect(fake.statements).toHaveLength(4);
   });
});
