import type { ApiSuccess, DeckStats, OverviewStats } from '@caly/shared';
import { apiFetch } from './client';

export function getDeckStats(deckId: string) {
   return apiFetch<ApiSuccess<DeckStats>>(`/stats/decks/${deckId}`);
}

export function getOverviewStats() {
   return apiFetch<ApiSuccess<OverviewStats>>('/stats/overview');
}
