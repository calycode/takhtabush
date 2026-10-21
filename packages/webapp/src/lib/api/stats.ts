import type { ApiSuccess, DeckStats } from '@caly/shared';
import { apiFetch } from './client';

export function getDeckStats(deckId: string) {
   return apiFetch<ApiSuccess<DeckStats>>(`/stats/decks/${deckId}`);
}
