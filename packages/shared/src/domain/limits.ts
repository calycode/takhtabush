/**
 * Bounded-work limits shared by the API, the web app, and MCP (SPEC §4.4).
 *
 * Every number here exists to keep a request's row reads bounded and
 * independent of how much content a user has accumulated. The reasoning and
 * the measured effect live in `docs/developer/d1-cost-model.md`; change the
 * document when you change a number.
 */
export const LIMITS = {
   /** Cards per deck. Bounds a full-deck plan, session snapshot, stats, and export. */
   cardsPerDeck: 500,
   /** Extra cards one bulk-create request may add. */
   cardsPerBulkCreate: 100,
   /** Tags on a single card (also the MCP/import tag ceiling). */
   tagsPerCard: 20,
   /** Characters in one tag. */
   tagLength: 40,
   /** Rows accepted by one import request. */
   importRows: 500,
   /** Bytes accepted by one import request (SPEC §6.4). */
   importBytes: 1_000_000,
   /** Decks placed in one collection. */
   decksPerCollection: 200,
   /** Collections one user may create. */
   collectionsPerUser: 100,
   /** Characters in a collection name. */
   collectionNameLength: 80,
} as const;

export const MAX_CARDS_PER_DECK = LIMITS.cardsPerDeck;
export const MAX_CARDS_PER_BULK_CREATE = LIMITS.cardsPerBulkCreate;
export const MAX_TAGS_PER_CARD = LIMITS.tagsPerCard;
export const MAX_TAG_LENGTH = LIMITS.tagLength;
export const MAX_IMPORT_ROWS = LIMITS.importRows;
export const MAX_IMPORT_BYTES = LIMITS.importBytes;
export const MAX_DECKS_PER_COLLECTION = LIMITS.decksPerCollection;
export const MAX_COLLECTIONS_PER_USER = LIMITS.collectionsPerUser;
export const MAX_COLLECTION_NAME_LENGTH = LIMITS.collectionNameLength;

/** Stable error code returned when a write would exceed a limit (SPEC §6.1). */
export const LIMIT_ERROR_CODES = {
   cardsPerDeck: 'DECK_CARD_LIMIT_EXCEEDED',
   cardsPerBulkCreate: 'BULK_CARD_LIMIT_EXCEEDED',
   decksPerCollection: 'COLLECTION_DECK_LIMIT_EXCEEDED',
   collectionsPerUser: 'COLLECTION_LIMIT_EXCEEDED',
} as const;

export type LimitErrorCode = (typeof LIMIT_ERROR_CODES)[keyof typeof LIMIT_ERROR_CODES];

/** Cards still allowed in a deck with `cardCount` live cards. */
export function remainingDeckCapacity(cardCount: number): number {
   return Math.max(0, MAX_CARDS_PER_DECK - Math.max(0, cardCount));
}
