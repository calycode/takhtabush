import { ACHIEVEMENTS } from '@caly/shared';
import { describe, expect, it } from 'vitest';
import { achievementRules, missingAchievementRules } from './achievement-service';

describe('achievement catalog', () => {
   it('has a unique id for every achievement', () => {
      const ids = ACHIEVEMENTS.map((achievement) => achievement.id);
      expect(new Set(ids).size).toBe(ids.length);
   });

   it('has an evaluation rule for every achievement', () => {
      expect(missingAchievementRules()).toEqual([]);
   });

   it('has no rules that are missing from the catalog', () => {
      const catalogIds = new Set(ACHIEVEMENTS.map((achievement) => achievement.id));
      expect(Object.keys(achievementRules()).filter((id) => !catalogIds.has(id))).toEqual([]);
   });
});
