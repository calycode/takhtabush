export const achievementCategorySchemaValues = [
   'starter',
   'consistency',
   'volume',
   'accuracy',
   'mastery',
   'explorer',
   'arcade',
   'social',
] as const;

export type AchievementCategory = (typeof achievementCategorySchemaValues)[number];

export const achievementTierSchemaValues = ['bronze', 'silver', 'gold', 'platinum'] as const;
export type AchievementTier = (typeof achievementTierSchemaValues)[number];

export type AchievementDefinition = {
   id: string;
   title: string;
   description: string;
   category: AchievementCategory;
   tier: AchievementTier;
   icon: string;
   shareText: string;
};

const def = (
   id: string,
   title: string,
   description: string,
   category: AchievementCategory,
   tier: AchievementTier,
   icon: string,
): AchievementDefinition => ({
   id,
   title,
   description,
   category,
   tier,
   icon,
   shareText: `I just unlocked "${title}" in Takhtabush!`,
});

/** The full achievement catalog. Evaluation rules live server-side. */
export const ACHIEVEMENTS: AchievementDefinition[] = [
   // Starter
   def('first_review', 'First Review', 'Review your first card.', 'starter', 'bronze', '🌱'),
   def('first_deck', 'First Deck', 'Create your first deck.', 'starter', 'bronze', '📚'),
   def('first_card', 'First Card', 'Add your first card.', 'starter', 'bronze', '🃏'),
   def(
      'first_session',
      'First Session',
      'Complete your first study session.',
      'starter',
      'bronze',
      '🎯',
   ),
   def('first_import', 'First Import', 'Import cards into a deck.', 'starter', 'bronze', '📥'),
   def(
      'first_collection',
      'First Collection',
      'Create your first collection.',
      'starter',
      'bronze',
      '🗂️',
   ),

   // Consistency
   def('streak_3', 'Warming Up', 'Study 3 days in a row.', 'consistency', 'bronze', '🔥'),
   def('streak_7', 'Week Warrior', 'Study 7 days in a row.', 'consistency', 'silver', '🔥'),
   def('streak_14', 'Fortnight Flame', 'Study 14 days in a row.', 'consistency', 'silver', '🔥'),
   def('streak_30', 'Monthly Machine', 'Study 30 days in a row.', 'consistency', 'gold', '🔥'),
   def('streak_60', 'Relentless', 'Study 60 days in a row.', 'consistency', 'platinum', '🔥'),
   def('streak_100', 'Century Streak', 'Study 100 days in a row.', 'consistency', 'platinum', '💯'),

   // Volume
   def('reviews_10', 'Ten Down', 'Complete 10 reviews.', 'volume', 'bronze', '🔟'),
   def('reviews_50', 'Fifty Reps', 'Complete 50 reviews.', 'volume', 'bronze', '🏋️'),
   def('reviews_100', 'Century Club', 'Complete 100 reviews.', 'volume', 'silver', '💯'),
   def('reviews_500', 'Five Hundred', 'Complete 500 reviews.', 'volume', 'silver', '⚡'),
   def('reviews_1000', 'Four Digits', 'Complete 1,000 reviews.', 'volume', 'gold', '🚀'),
   def('reviews_5000', 'Review Machine', 'Complete 5,000 reviews.', 'volume', 'platinum', '🤖'),
   def('reviews_10000', 'Ten Thousand', 'Complete 10,000 reviews.', 'volume', 'platinum', '🌌'),
   def('sessions_10', 'Regular', 'Complete 10 study sessions.', 'volume', 'bronze', '🗓️'),
   def('sessions_50', 'Committed', 'Complete 50 study sessions.', 'volume', 'silver', '📅'),
   def('sessions_100', 'Centurion', 'Complete 100 study sessions.', 'volume', 'gold', '🏛️'),
   def('sessions_500', 'Marathoner', 'Complete 500 study sessions.', 'volume', 'platinum', '🏃'),
   def('cards_100', 'Card Hoarder', 'Have 100 cards in your library.', 'volume', 'bronze', '🃏'),
   def('cards_500', 'Card Collector', 'Have 500 cards in your library.', 'volume', 'silver', '🃏'),
   def('cards_1000', 'Card Baron', 'Have 1,000 cards in your library.', 'volume', 'gold', '👑'),
   def('decks_5', 'Deck Builder', 'Create 5 decks.', 'volume', 'bronze', '🧱'),
   def('decks_10', 'Deck Architect', 'Create 10 decks.', 'volume', 'silver', '🏗️'),
   def('decks_25', 'Deck Empire', 'Create 25 decks.', 'volume', 'gold', '🏰'),
   def('collections_5', 'Curator', 'Create 5 collections.', 'volume', 'silver', '🗄️'),
   def('collections_10', 'Librarian', 'Create 10 collections.', 'volume', 'gold', '📚'),
   def('tags_10', 'Tagger', 'Use 10 distinct tags.', 'volume', 'bronze', '🏷️'),
   def('tags_25', 'Taxonomist', 'Use 25 distinct tags.', 'volume', 'silver', '🏷️'),

   // Accuracy
   def('accuracy_80', 'Sharp', 'Reach 80% accuracy over 100 reviews.', 'accuracy', 'bronze', '🎯'),
   def(
      'accuracy_90',
      'Precise',
      'Reach 90% accuracy over 250 reviews.',
      'accuracy',
      'silver',
      '🎯',
   ),
   def('accuracy_95', 'Surgical', 'Reach 95% accuracy over 500 reviews.', 'accuracy', 'gold', '🔪'),
   def(
      'perfect_session',
      'Flawless',
      'Finish a session of 10+ cards without a miss.',
      'accuracy',
      'silver',
      '✨',
   ),
   def(
      'perfect_sessions_10',
      'Ten Flawless Runs',
      'Finish 10 flawless sessions.',
      'accuracy',
      'gold',
      '✨',
   ),
   def(
      'fast_10',
      'Quick Draw',
      'Answer 10 cards correctly in under 3 seconds.',
      'accuracy',
      'bronze',
      '⚡',
   ),
   def(
      'fast_100',
      'Lightning',
      'Answer 100 cards correctly in under 3 seconds.',
      'accuracy',
      'silver',
      '⚡',
   ),
   def(
      'fast_500',
      'Speedrunner',
      'Answer 500 cards correctly in under 3 seconds.',
      'accuracy',
      'gold',
      '🏎️',
   ),
   def('easy_100', 'Easy Street', 'Rate 100 cards “easy”.', 'accuracy', 'silver', '😎'),
   def('hard_100', 'No Quit', 'Rate 100 cards “hard”.', 'accuracy', 'silver', '💪'),
   def('again_100', 'Persistence', 'Rate 100 cards “again”.', 'accuracy', 'silver', '🔁'),

   // Time of day
   def(
      'night_owl',
      'Night Owl',
      'Review 50 cards between midnight and 5am.',
      'consistency',
      'silver',
      '🦉',
   ),
   def(
      'early_bird',
      'Early Bird',
      'Review 50 cards between 5am and 8am.',
      'consistency',
      'silver',
      '🐦',
   ),

   // Mastery
   def(
      'mastered_10',
      'Ten Mastered',
      'Master 10 cards (21+ day interval).',
      'mastery',
      'bronze',
      '🌟',
   ),
   def('mastered_50', 'Fifty Mastered', 'Master 50 cards.', 'mastery', 'silver', '🌟'),
   def('mastered_100', 'Hundred Mastered', 'Master 100 cards.', 'mastery', 'gold', '🌟'),
   def('mastered_250', 'Deep Roots', 'Master 250 cards.', 'mastery', 'platinum', '🌳'),
   def('mastered_500', 'Grandmaster', 'Master 500 cards.', 'mastery', 'platinum', '🏆'),
   def('deck_full', 'Full House', 'Fill a deck to 500 cards.', 'mastery', 'gold', '🎴'),
   def(
      'marathon',
      'Marathon Session',
      'Complete a session with 100+ reviews.',
      'mastery',
      'gold',
      '🏃',
   ),
   def('import_500', 'Bulk Import', 'Import 500 cards.', 'mastery', 'silver', '📦'),
   def(
      'lapses_100',
      'Scar Tissue',
      'Accumulate 100 lapses and keep going.',
      'mastery',
      'silver',
      '🩹',
   ),

   // Arcade
   def('first_game', 'Insert Coin', 'Start your first arcade run.', 'arcade', 'bronze', '🕹️'),
   def('games_50', 'Arcade Regular', 'Play 50 arcade runs.', 'arcade', 'silver', '🕹️'),
   def('survival_first_win', 'Survivor', 'Win your first survival run.', 'arcade', 'silver', '❤️'),
   def('survival_10_wins', 'Hard to Kill', 'Win 10 survival runs.', 'arcade', 'gold', '❤️'),
   def('survival_25_wins', 'Unkillable', 'Win 25 survival runs.', 'arcade', 'platinum', '🛡️'),
   def('boss_first_win', 'Boss Slayer', 'Win your first boss fight.', 'arcade', 'silver', '⚔️'),
   def('boss_10_wins', 'Boss Hunter', 'Win 10 boss fights.', 'arcade', 'gold', '⚔️'),
   def('bosses_25', 'Boss Collector', 'Defeat 25 bosses.', 'arcade', 'gold', '💀'),
   def('combo_10', 'Combo Starter', 'Reach a 10x combo.', 'arcade', 'bronze', '🔗'),
   def('combo_25', 'Combo Master', 'Reach a 25x combo.', 'arcade', 'gold', '🔗'),
   def('score_1000', 'High Score', 'Score 1,000 points in one run.', 'arcade', 'silver', '🏅'),
   def(
      'score_5000',
      'Leaderboard Legend',
      'Score 5,000 points in one run.',
      'arcade',
      'platinum',
      '🏆',
   ),

   // Social
   def('shared_achievement', 'Show Off', 'Share an achievement.', 'social', 'bronze', '📣'),
   def('shared_5', 'Hype Machine', 'Share 5 achievements.', 'social', 'silver', '📣'),
];

export const ACHIEVEMENTS_BY_ID = new Map(ACHIEVEMENTS.map((item) => [item.id, item]));

export const ACHIEVEMENT_CATEGORY_LABELS: Record<AchievementCategory, string> = {
   starter: 'First steps',
   consistency: 'Consistency',
   volume: 'Volume',
   accuracy: 'Accuracy',
   mastery: 'Mastery',
   explorer: 'Explorer',
   arcade: 'Arcade',
   social: 'Social',
};
