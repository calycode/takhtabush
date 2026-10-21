import type { AppEnv } from '../env';

export type DeckCounts = {
   totalCards: number;
   newCards: number;
   learningCards: number;
   suspendedCards: number;
};

export async function getDeckCounts(
   env: AppEnv,
   userId: string,
   deckId: string,
): Promise<DeckCounts> {
   const row = await env.DB.prepare(
      `SELECT
          COUNT(*) AS total_cards,
          COALESCE(SUM(CASE WHEN ls.card_id IS NULL THEN 1 ELSE 0 END), 0) AS new_cards,
          COALESCE(SUM(CASE WHEN ls.card_id IS NOT NULL THEN 1 ELSE 0 END), 0) AS learning_cards,
          COALESCE(SUM(CASE WHEN c.status = 'suspended' THEN 1 ELSE 0 END), 0) AS suspended_cards
         FROM cards c
         LEFT JOIN learning_state ls ON ls.card_id = c.id AND ls.user_id = ?
        WHERE c.deck_id = ? AND c.deleted_at IS NULL`,
   )
      .bind(userId, deckId)
      .first<{
         total_cards: number;
         new_cards: number;
         learning_cards: number;
         suspended_cards: number;
      }>();

   return {
      totalCards: Number(row?.total_cards ?? 0),
      newCards: Number(row?.new_cards ?? 0),
      learningCards: Number(row?.learning_cards ?? 0),
      suspendedCards: Number(row?.suspended_cards ?? 0),
   };
}
