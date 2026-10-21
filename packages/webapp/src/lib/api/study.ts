import type {
   ApiSuccess,
   ReviewResult,
   StartSessionRequest,
   StudyPreview,
   StudyPreviewInput,
   StudyRecommendation,
   StudySession,
   StudySessionDetail,
   StudyPlan,
} from '@caly/shared';
import { apiFetch } from './client';

export function previewStudy(input: StudyPreviewInput) {
   return apiFetch<ApiSuccess<StudyPreview>>('/study/preview', {
      method: 'POST',
      body: JSON.stringify(input),
   });
}

export function listSessions(status?: 'active' | 'completed' | 'abandoned') {
   const query = status ? `?status=${status}` : '';
   return apiFetch<ApiSuccess<StudySession[]>>(`/study/sessions${query}`);
}

export function startSession(input: StartSessionRequest) {
   return apiFetch<ApiSuccess<{ session: StudySession; plan: StudyPlan }>>('/study/sessions', {
      method: 'POST',
      body: JSON.stringify(input),
   });
}

export function getSession(id: string) {
   return apiFetch<ApiSuccess<StudySessionDetail>>(`/study/sessions/${id}`);
}

export function abandonSession(id: string) {
   return apiFetch<ApiSuccess<StudySession>>(`/study/sessions/${id}/abandon`, { method: 'POST' });
}

export function recordReview(
   sessionId: string,
   input: { cardId: string; response: 'again' | 'hard' | 'good' | 'easy'; durationMs?: number },
) {
   return apiFetch<ApiSuccess<ReviewResult>>(`/study/sessions/${sessionId}/reviews`, {
      method: 'POST',
      body: JSON.stringify(input),
   });
}

export function completeSession(sessionId: string) {
   return apiFetch<ApiSuccess<StudySession>>(`/study/sessions/${sessionId}/complete`, {
      method: 'POST',
   });
}

export function getRecommendation(params: { deckId: string; minutes?: number; goal?: string }) {
   const query = new URLSearchParams({
      deckId: params.deckId,
      minutes: String(params.minutes ?? 15),
      goal: params.goal ?? 'learn',
   });
   return apiFetch<ApiSuccess<StudyRecommendation>>(`/study/recommendation?${query.toString()}`);
}
