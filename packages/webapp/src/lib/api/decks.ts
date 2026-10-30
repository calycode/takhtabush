import type {
   ApiSuccess,
   CreateCardRequest,
   CreateDeckInput,
   Deck,
   Card,
   ExportFormat,
   ImportDeckRequest,
   ImportResult,
   StudyOptions,
   UpdateCardRequest,
   UpdateDeckInput,
} from '@caly/shared';
import { API_BASE_URL, apiFetch } from './client';

type PageResponse<T> = { data: T[]; meta: { nextCursor: string | null; hasMore: boolean } };

export function listDecks(
   opts: { cursor?: string; collectionId?: string; unfiled?: boolean } = {},
) {
   const params = new URLSearchParams();
   if (opts.cursor) params.set('cursor', opts.cursor);
   if (opts.collectionId) params.set('collectionId', opts.collectionId);
   else if (opts.unfiled) params.set('unfiled', 'true');
   const query = params.toString();
   return apiFetch<PageResponse<Deck>>(`/decks${query ? `?${query}` : ''}`);
}

export function getDeck(id: string) {
   return apiFetch<ApiSuccess<Deck>>(`/decks/${id}`);
}

export function createDeck(input: CreateDeckInput) {
   return apiFetch<ApiSuccess<Deck>>('/decks', { method: 'POST', body: JSON.stringify(input) });
}

export function updateDeck(id: string, input: UpdateDeckInput) {
   return apiFetch<ApiSuccess<Deck>>(`/decks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
   });
}

export function deleteDeck(id: string) {
   return apiFetch<void>(`/decks/${id}`, { method: 'DELETE' });
}

export function getStudyOptions(id: string) {
   return apiFetch<ApiSuccess<StudyOptions>>(`/decks/${id}/study-options`);
}

/** Download an export as a file blob (robust across embedded/iframe contexts). */
export async function downloadDeckExport(deckId: string, format: ExportFormat): Promise<void> {
   const response = await fetch(`${API_BASE_URL}/decks/${deckId}/export?format=${format}`, {
      credentials: 'include',
   });
   if (!response.ok) throw new Error('Export failed');

   const blob = await response.blob();
   const url = URL.createObjectURL(blob);
   const anchor = document.createElement('a');
   anchor.href = url;
   anchor.download = `${deckId}.${format}`;
   document.body.append(anchor);
   anchor.click();
   anchor.remove();
   URL.revokeObjectURL(url);
}

export function listCards(deckId: string, cursor?: string) {
   const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
   return apiFetch<PageResponse<Card>>(`/decks/${deckId}/cards${query}`);
}

/** Page through every card in a deck (the API caps a page at 50). */
export async function listAllDeckCards(deckId: string): Promise<Card[]> {
   const cards: Card[] = [];
   let cursor: string | undefined;
   for (;;) {
      const page = await listCards(deckId, cursor);
      cards.push(...page.data);
      if (!page.meta.hasMore || !page.meta.nextCursor) break;
      cursor = page.meta.nextCursor;
   }
   return cards;
}

export function createCard(deckId: string, input: CreateCardRequest) {
   return apiFetch<ApiSuccess<Card>>(`/decks/${deckId}/cards`, {
      method: 'POST',
      body: JSON.stringify(input),
   });
}

export function getCard(id: string) {
   return apiFetch<ApiSuccess<Card>>(`/cards/${id}`);
}

export function updateCard(id: string, input: UpdateCardRequest) {
   return apiFetch<ApiSuccess<Card>>(`/cards/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
   });
}

export function suspendCard(id: string) {
   return apiFetch<ApiSuccess<Card>>(`/cards/${id}/suspend`, { method: 'POST' });
}

export function resumeCard(id: string) {
   return apiFetch<ApiSuccess<Card>>(`/cards/${id}/resume`, { method: 'POST' });
}

export function deleteCard(id: string) {
   return apiFetch<void>(`/cards/${id}`, { method: 'DELETE' });
}

export function restoreCard(id: string) {
   return apiFetch<ApiSuccess<Card>>(`/cards/${id}/restore`, { method: 'POST' });
}

export function importDeck(deckId: string, input: ImportDeckRequest) {
   return apiFetch<ApiSuccess<ImportResult>>(`/decks/${deckId}/import`, {
      method: 'POST',
      body: JSON.stringify(input),
   });
}
