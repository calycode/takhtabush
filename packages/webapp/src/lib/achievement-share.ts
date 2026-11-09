import type { Achievement } from '@caly/shared';
import { shareAchievement } from './api/achievements';

export type ShareNetwork = 'x' | 'reddit' | 'bluesky';

export function achievementShareText(achievement: Achievement): string {
   return `${achievement.shareText} ${window.location.origin}`;
}

export function achievementShareUrl(network: ShareNetwork, achievement: Achievement): string {
   const url = window.location.origin;
   const text = achievementShareText(achievement);
   switch (network) {
      case 'x':
         return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
      case 'reddit':
         return `https://www.reddit.com/submit?title=${encodeURIComponent(
            achievement.shareText,
         )}&url=${encodeURIComponent(url)}`;
      case 'bluesky':
         return `https://bsky.app/intent/compose?text=${encodeURIComponent(text)}`;
   }
}

export function openAchievementShare(network: ShareNetwork, achievement: Achievement): void {
   window.open(achievementShareUrl(network, achievement), '_blank', 'noopener,noreferrer');
}

export async function copyAchievementShare(achievement: Achievement): Promise<void> {
   if (!navigator.clipboard) return;
   await navigator.clipboard.writeText(achievementShareText(achievement)).catch(() => undefined);
}

/** Record the share and return any achievements it unlocked (e.g. Show Off). */
export async function recordAchievementShare(achievement: Achievement): Promise<Achievement[]> {
   const result = await shareAchievement(achievement.id);
   return result.data.newAchievements;
}
