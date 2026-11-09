import type { Achievement } from '@caly/shared';

export const ACHIEVEMENT_EVENT = 'takhtabush:achievements';

/** Broadcast newly unlocked achievements to the global celebration toast. */
export function announceAchievements(items: Achievement[]): void {
   if (items.length === 0) return;
   window.dispatchEvent(new CustomEvent<Achievement[]>(ACHIEVEMENT_EVENT, { detail: items }));
}
