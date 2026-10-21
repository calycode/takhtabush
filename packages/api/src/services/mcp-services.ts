import type {
   DeckSummary,
   McpCardSummary,
   McpDueState,
   McpServices,
   StudyGoal,
   StudySessionSnapshot,
   StudyWidgetCard,
   User,
} from '@caly/shared';
import { nowIso } from '@caly/worker-kit';
import type { AppEnv } from '../env';
import { mapCard, mapDeck } from '../lib/map';
import { getCardRow, searchCardsPage } from '../repositories/cards';
import { getDeckRow } from '../repositories/decks';
import { deckDueCounts, listReviewedCardIds } from '../repositories/study';
import { insertAuditEvent } from '../repositories/audit';
import { createCard, getOwnedCard, patchCard, removeCard } from './card-service';
import { createDeck, getOwnedDeck, listDecksForUser } from './deck-service';
import { importIntoDeck } from './import-service';
import { readStudyWidgetResource } from './mcp-apps-service';
import { computeDeckStats } from './stats-service';
import { getSession, recommendStudyPlan, recordReview, startSession } from './study-service';

type Row = Record<string, unknown>;

/** Map a card search row (with SQL-computed `due_state`) to the compact projection. */
function summaryFromRow(row: Row): McpCardSummary {
   const tags = typeof row.tags_json === 'string' ? (JSON.parse(row.tags_json) as string[]) : [];
   return {
      id: String(row.id),
      deckId: String(row.deck_id),
      frontPreview: String(row.front).slice(0, 120),
      type: row.type as McpCardSummary['type'],
      tags: tags.slice(0, 10),
      dueState: row.due_state as McpDueState,
      accuracy: null,
   };
}

/**
 * Bind the domain services to a single authenticated user and expose them to
 * the MCP package. MCP never touches D1/R2 directly (SPEC §2.3, D10).
 */
export function buildMcpServices(env: AppEnv, user: User, _requestId: string | null): McpServices {
   return {
      async listDecks(input) {
         const { items, nextCursor } = await listDecksForUser(env, user.id, {
            limit: input.limit,
            cursor: input.cursor,
         });
         const dueCounts = await deckDueCounts(env, user.id, nowIso());
         const summaries: DeckSummary[] = items.map((deck) => ({
            id: deck.id,
            title: deck.title,
            description: deck.description ? deck.description.slice(0, 160) : null,
            cardCount: deck.cardCount,
            dueCount: dueCounts[deck.id] ?? 0,
            updatedAt: deck.updatedAt,
         }));
         return { items: summaries, nextCursor };
      },

      async getDeck(input) {
         const row = await getDeckRow(env, input.id);
         if (!row || String(row.owner_id) !== user.id) return null;
         const deck = mapDeck(row);
         let cards: McpCardSummary[] = [];
         if (input.includeCards) {
            const { rows } = await searchCardsPage(env, {
               ownerId: user.id,
               deckId: deck.id,
               limit: input.limit,
            });
            cards = rows.map(summaryFromRow);
         }
         return { deck, cards };
      },

      async searchCards(input) {
         const { rows, nextCursor } = await searchCardsPage(env, {
            ownerId: user.id,
            deckId: input.deckId,
            query: input.query,
            tag: input.tag,
            due: input.due,
            limit: input.limit,
            cursor: input.cursor,
         });
         return { items: rows.map(summaryFromRow), nextCursor };
      },

      async getCard(id) {
         const row = await getCardRow(env, id);
         if (!row || String(row.owner_id) !== user.id) return null;
         return mapCard(row);
      },

      async getLearningStats(deckId) {
         try {
            return await computeDeckStats(env, user.id, deckId);
         } catch {
            return null;
         }
      },

      getStudyPlan: (input) =>
         recommendStudyPlan(env, user.id, {
            deckId: input.deckId,
            mode: input.mode,
            goal: input.goal as StudyGoal,
            minutes: input.minutes,
            cardIds: input.cardIds,
         }),

      createDeck: (input) => createDeck(env, user.id, input),

      createCards: (input) =>
         Promise.all(input.cards.map((card) => createCard(env, user.id, input.deckId, card))),

      importDeck: (input) =>
         importIntoDeck(env, user.id, input.deckId, {
            format: input.format,
            content: input.content,
            hasHeader: input.hasHeader,
            tags: input.tags,
            delimiter: input.delimiter,
            tagSeparator: input.tagSeparator,
         }),

      async updateCard(input) {
         const { id, ...patch } = input;
         try {
            return await patchCard(env, user.id, id, patch);
         } catch {
            return null;
         }
      },

      async deleteCard(id) {
         try {
            await getOwnedCard(env, user.id, id);
            await removeCard(env, user.id, id);
            return true;
         } catch {
            return false;
         }
      },

      async startStudySession(input) {
         const { session } = await startSession(env, user.id, input, 'mcp');
         return session;
      },

      recordReview: (input) =>
         recordReview(env, user.id, input.sessionId, {
            cardId: input.cardId,
            response: input.response,
            durationMs: input.durationMs,
         }),

      // [R6] Server-authoritative snapshot for the MCP Apps widget. Reads only
      // compact card fields; never exposes D1 rows or scheduler internals (§9.8).
      async getStudySession(sessionId): Promise<StudySessionSnapshot | null> {
         try {
            const session = await getSession(env, user.id, sessionId);
            const deck = await getOwnedDeck(env, user.id, session.deckId);
            const reviewed = await listReviewedCardIds(env, sessionId);
            const cards: StudyWidgetCard[] = [];
            for (const cardId of session.plannedCardIds) {
               const row = await getCardRow(env, cardId);
               if (!row || String(row.owner_id) !== user.id) continue;
               const card = mapCard(row);
               cards.push({
                  id: card.id,
                  type: card.type,
                  front: card.front,
                  back: card.back,
                  clozeText: card.clozeText,
                  choices: card.choices,
                  correctChoice: card.correctChoice,
                  imageUrl: card.imageMediaId ? `/media/${card.imageMediaId}` : null,
                  audioUrl: card.audioMediaId ? `/media/${card.audioMediaId}` : null,
               });
            }
            return {
               sessionId: session.id,
               deckId: session.deckId,
               deckTitle: deck.title,
               mode: session.mode,
               status: session.status,
               total: session.plannedCardIds.length,
               reviewed: reviewed.size,
               reviewedCardIds: [...reviewed],
               cards,
               fallbackStudyPath: `/study/${session.id}`,
            };
         } catch {
            return null;
         }
      },

      async readUiResource(uri) {
         return readStudyWidgetResource(uri);
      },

      recordAudit: (event) => insertAuditEvent(env, event),
   };
}
