import type { Card } from '../api/cards';
import { markdownToText } from './markdown';
import { normalizeAnswer } from './grading';
import { seededShuffle } from './shuffle';

export { seededRandom, seededShuffle } from './shuffle';

/** The card fields the shared study interactions need, regardless of surface. */
export type StudyCardData = {
   id: string;
   type: Card['type'];
   front: string;
   back: string | null;
   clozeText: string | null;
   choices: string[] | null;
   correctChoice: number | null;
   imageUrl: string | null;
   audioUrl: string | null;
};

/** How many cards are paired at once in the matching.pairs layout. */
export const MATCHING_BATCH_SIZE = 4;

/** The answer side of a card, flattened for comparison and pairing. */
export function cardAnswer(card: StudyCardData): string {
   if (card.choices && card.correctChoice !== null) {
      return card.choices[card.correctChoice] ?? '';
   }
   return markdownToText(card.back ?? '') || card.front;
}

/** De-duplicate option text without changing what is displayed. */
function uniqueAnswers(values: string[]): string[] {
   const seen = new Set<string>();
   const result: string[] = [];
   for (const value of values) {
      const key = normalizeAnswer(value) || value.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      result.push(value);
   }
   return result;
}

/**
 * Options for recognition-style cards. Authored choices win; otherwise draw up
 * to three distractors from the session pool (SPEC §10.5).
 *
 * `seed` lets the caller reshuffle a card on each attempt. Without it the
 * position of the correct answer is fixed forever, which rewards memorising
 * the layout instead of the card.
 */
export function choiceOptionsFor(
   card: StudyCardData,
   pool: StudyCardData[],
   seed: string = card.id,
): string[] {
   const correct = cardAnswer(card);
   const correctKey = normalizeAnswer(correct);
   const candidates = card.choices?.length
      ? uniqueAnswers(card.choices)
      : uniqueAnswers(pool.filter((item) => item.id !== card.id).map(cardAnswer));
   const distractors = candidates.filter((value) => normalizeAnswer(value) !== correctKey);

   const picked = seededShuffle(distractors, `${seed}|distractors`).slice(0, 3);
   return seededShuffle([correct, ...picked], `${seed}|options`).filter(Boolean);
}
