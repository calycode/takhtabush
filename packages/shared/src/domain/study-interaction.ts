import type { Card } from '../api/cards';
import type { StudyMode } from './modes';
import { extractClozeTokens } from './grading';

/** The concrete interaction a card uses within a session (SPEC §10.5). */
export type StudyInteraction = 'flashcards' | 'choice' | 'typed' | 'cloze';

/** The subset of a card the interaction decision needs (app card or widget DTO). */
export type InteractionCard = {
   type: Card['type'];
   front: string;
   back: string | null;
   clozeText: string | null;
};

/**
 * Resolve how a card should be presented for a mode. Shared by the web app and
 * the MCP Apps widget so both derive the same interaction from the same rules.
 */
export function interactionFor(card: InteractionCard, mode: StudyMode): StudyInteraction {
   const hasBlanks = extractClozeTokens(card.clozeText ?? card.front).length > 0;
   const hasBack = Boolean(card.back);

   if (mode === 'multiple_choice' || mode === 'matching') return 'choice';
   if (mode === 'typed') return hasBack ? 'typed' : 'flashcards';
   // A cloze exercise is only possible when the card actually has blanks;
   // otherwise fall back so the card is still gradeable.
   if (mode === 'cloze') return hasBlanks ? 'cloze' : hasBack ? 'typed' : 'flashcards';
   if (mode === 'flashcards') return 'flashcards';
   switch (card.type) {
      case 'multiple_choice':
         return 'choice';
      case 'typed':
         return 'typed';
      case 'cloze':
         return hasBlanks ? 'cloze' : hasBack ? 'typed' : 'flashcards';
      default:
         return 'flashcards';
   }
}
