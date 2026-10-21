import type { TagSummary } from '@caly/shared';
import type { AppEnv } from '../env';
import { listOwnedTagStrings } from '../repositories/cards';

/** Distinct tags across the user's cards, most used first. */
export async function listTags(env: AppEnv, userId: string): Promise<TagSummary[]> {
   const tags = await listOwnedTagStrings(env, userId);
   const counts = new Map<string, number>();
   for (const tag of tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
   return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
