import { sha256Hex } from '../../lib/crypto';
import { CARD_EVALUATION_SCHEMA_VERSION } from './schemas';

/** Deterministic cache key: schema version + card content (SPEC §8.1). */
export function cardInputHash(card: {
   type: string;
   front: string;
   back?: string | null;
   clozeText?: string | null;
}): Promise<string> {
   return sha256Hex(
      JSON.stringify({
         v: CARD_EVALUATION_SCHEMA_VERSION,
         type: card.type,
         front: card.front,
         back: card.back ?? null,
         cloze: card.clozeText ?? null,
      }),
   );
}

export function strategyInputHash(signals: Record<string, number>): Promise<string> {
   return sha256Hex(JSON.stringify({ v: CARD_EVALUATION_SCHEMA_VERSION, signals }));
}
