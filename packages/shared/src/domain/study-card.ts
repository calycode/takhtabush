import type { Card } from '../api/cards';
import { markdownToText } from './markdown';

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

/** Deterministic shuffle so options and pairing batches stay stable. */
export function seededShuffle<T>(items: T[], seed: string): T[] {
   let hash = 2166136261;
   for (let i = 0; i < seed.length; i++) {
      hash ^= seed.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
   }
   const rand = () => {
      hash += 0x6d2b79f5;
      let t = hash;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
   };
   const copy = [...items];
   for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
   }
   return copy;
}

/** The answer side of a card, flattened for comparison and pairing. */
export function cardAnswer(card: StudyCardData): string {
   if (card.choices && card.correctChoice !== null) {
      return card.choices[card.correctChoice] ?? '';
   }
   return markdownToText(card.back ?? '') || card.front;
}

/**
 * Options for recognition-style cards. Authored choices win; otherwise draw up
 * to three distractors from the session pool (SPEC §10.5).
 */
export function choiceOptionsFor(card: StudyCardData, pool: StudyCardData[]): string[] {
   if (card.choices?.length) return card.choices;

   const correct = cardAnswer(card);
   const distractors = pool
      .filter((item) => item.id !== card.id)
      .map(cardAnswer)
      .filter((value) => value.length > 0 && value !== correct);
   const picked = seededShuffle(distractors, card.id).slice(0, 3);
   return seededShuffle([correct, ...picked], `${card.id}|options`).filter(Boolean);
}
