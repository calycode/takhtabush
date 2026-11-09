import type { AchievementEvaluateResponse, AchievementsResponse, ApiSuccess } from '@caly/shared';
import { apiFetch } from './client';

export function getAchievements() {
   return apiFetch<ApiSuccess<AchievementsResponse>>('/achievements');
}

export function evaluateAchievements() {
   return apiFetch<ApiSuccess<AchievementEvaluateResponse>>('/achievements/evaluate', {
      method: 'POST',
   });
}

export function markAchievementsSeen(ids: string[]) {
   return apiFetch<void>('/achievements/seen', {
      method: 'POST',
      body: JSON.stringify({ ids }),
   });
}

export function shareAchievement(id: string) {
   return apiFetch<ApiSuccess<AchievementEvaluateResponse>>(`/achievements/${id}/share`, {
      method: 'POST',
   });
}
