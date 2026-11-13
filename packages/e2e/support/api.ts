import type { APIRequestContext } from '@playwright/test';
import type { Card, CreateCardRequest, Deck } from '@caly/shared';

type Envelope<T> = { data: T };

const API_BASE = '/api/v1';

/**
 * Thin client for seeding and inspecting data without clicking through the UI.
 * Uses the browser context's own cookie jar, so the session and the CSRF
 * double-submit token always match what the page sees.
 */
export class ApiClient {
   constructor(
      private readonly request: APIRequestContext,
      private readonly csrfToken: () => Promise<string>,
   ) {}

   private async send<T>(method: string, path: string, data?: unknown): Promise<T> {
      const headers: Record<string, string> = {};
      if (method !== 'GET') headers['x-csrf-token'] = await this.csrfToken();

      const response = await this.request.fetch(`${API_BASE}${path}`, {
         method,
         data,
         headers,
         failOnStatusCode: false,
      });
      const text = await response.text();
      if (!response.ok()) {
         throw new Error(`${method} ${path} failed with ${response.status()}: ${text}`);
      }
      if (text === '') return null as T;
      return (JSON.parse(text) as Envelope<T>).data;
   }

   createDeck(input: { title: string; description?: string }): Promise<Deck> {
      return this.send<Deck>('POST', '/decks', input);
   }

   deleteDeck(id: string): Promise<void> {
      return this.send<void>('DELETE', `/decks/${id}`);
   }

   createCard(deckId: string, input: CreateCardRequest): Promise<Card> {
      return this.send<Card>('POST', `/decks/${deckId}/cards`, input);
   }
}

export type SeededDeck = {
   deck: Deck;
   cards: Card[];
};

/** A card draft that may omit the type; seeded cards default to term/definition. */
export type SeedCard = Omit<CreateCardRequest, 'type'> & {
   type?: CreateCardRequest['type'];
};

/** Create a deck with cards through the API; returns their ids for assertions. */
export async function createDeckWithCards(
   api: ApiClient,
   options: { title: string; cards?: SeedCard[] },
): Promise<SeededDeck> {
   const deck = await api.createDeck({ title: options.title });
   const drafts: SeedCard[] =
      options.cards ??
      [1, 2, 3].map((index) => ({
         front: `Front ${index}`,
         back: `Back ${index}`,
      }));

   const cards: Card[] = [];
   for (const draft of drafts) {
      cards.push(
         await api.createCard(deck.id, {
            type: draft.type ?? 'term_definition',
            front: draft.front,
            back: draft.back,
            tags: draft.tags,
         }),
      );
   }
   return { deck, cards };
}
