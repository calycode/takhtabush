import { z } from 'zod';
import { MAX_CARDS_PER_BULK_CREATE, MAX_CARDS_PER_DECK, MAX_IMPORT_ROWS } from '../domain/limits';
import { idSchema, isoDateSchema } from './common';
import type {
   Card,
   CreateCardInput,
   ImportDeckInput,
   ImportResult,
   UpdateCardInput,
} from './cards';
import { createCardInputSchema, importDeckInputSchema, updateCardInputSchema } from './cards';
import type { Deck, CreateDeckInput, DeckSummary } from './decks';
import { createDeckInputSchema } from './decks';
import type { DeckStats } from './stats';
import type { ReviewEventInput, ReviewResult, StartSessionInput, StudySession } from './study';
import { reviewEventInputSchema, startSessionInputSchema } from './study';
import type { StudyRecommendation } from './study';
import type { McpUiResourceContent, StudySessionSnapshot } from './study-widget';
import { MCP_STUDY_WIDGET_RESOURCE_URI } from './study-widget';
import type { StudyGoal, StudyMode } from '../domain/modes';
import { studyGoalSchema, studyModeSchema } from '../domain/modes';

/** OAuth scopes that authorize individual MCP tools (SPEC §9.3). */
export const mcpScopeSchema = z.enum([
   'decks:read',
   'stats:read',
   'decks:write',
   'study:write',
   'media:write',
   'study:render',
]);

export type McpScope = z.infer<typeof mcpScopeSchema>;

export const MCP_ALL_SCOPES = mcpScopeSchema.options;

export const mcpToolNameSchema = z.enum([
   'list_decks',
   'get_deck',
   'search_cards',
   'get_card',
   'get_learning_stats',
   'get_study_plan',
   'create_deck',
   'create_cards',
   'import_deck',
   'update_card',
   'delete_card',
   'start_study_session',
   'record_review',
   'get_study_session',
   'render_study_session',
]);

export type McpToolName = z.infer<typeof mcpToolNameSchema>;

/** Tool → required scope mapping (SPEC §9.4). */
export const MCP_TOOL_SCOPES: Record<McpToolName, McpScope> = {
   list_decks: 'decks:read',
   get_deck: 'decks:read',
   search_cards: 'decks:read',
   get_card: 'decks:read',
   get_learning_stats: 'stats:read',
   get_study_plan: 'stats:read',
   create_deck: 'decks:write',
   create_cards: 'decks:write',
   import_deck: 'decks:write',
   update_card: 'decks:write',
   delete_card: 'decks:write',
   start_study_session: 'study:write',
   record_review: 'study:write',
   get_study_session: 'decks:read',
   render_study_session: 'study:render',
};

export const mcpDueStateSchema = z.enum(['new', 'due', 'scheduled', 'suspended']);
export type McpDueState = z.infer<typeof mcpDueStateSchema>;

/** Compact card projection (SPEC §9.5). */
export const mcpCardSummarySchema = z.object({
   id: idSchema,
   deckId: idSchema,
   frontPreview: z.string().max(120),
   type: z.enum(['term_definition', 'cloze', 'multiple_choice', 'typed', 'image_prompt']),
   tags: z.array(z.string()).max(10),
   dueState: mcpDueStateSchema,
   accuracy: z.number().nullable(),
});

export type McpCardSummary = z.infer<typeof mcpCardSummarySchema>;

export const mcpListInputSchema = z.object({
   limit: z.number().int().min(1).max(50).default(20),
   cursor: z.string().min(1).optional(),
});

export const mcpSearchCardsInputSchema = z.object({
   deckId: idSchema.optional(),
   query: z.string().max(200).optional(),
   tag: z.string().max(40).optional(),
   due: mcpDueStateSchema.optional(),
   limit: z.number().int().min(1).max(50).default(20),
   cursor: z.string().min(1).optional(),
});

export type McpSearchCardsInput = z.infer<typeof mcpSearchCardsInputSchema>;

export const mcpGetDeckInputSchema = z.object({
   id: idSchema,
   includeCards: z.boolean().default(false),
   limit: z.number().int().min(1).max(50).default(20),
});

export const mcpCreateCardsInputSchema = z.object({
   deckId: idSchema,
   cards: z.array(createCardInputSchema).min(1).max(MAX_CARDS_PER_BULK_CREATE),
});

export const mcpImportDeckInputSchema = importDeckInputSchema.extend({ deckId: idSchema });

export const mcpUpdateCardInputSchema = updateCardInputSchema.extend({ id: idSchema });

export const mcpDeleteCardInputSchema = z.object({ id: idSchema });

export const mcpStartSessionInputSchema = startSessionInputSchema;

export const mcpRecordReviewInputSchema = reviewEventInputSchema.extend({ sessionId: idSchema });

export const mcpGetStudyPlanInputSchema = z.object({
   deckId: idSchema,
   mode: studyModeSchema.default('mixed'),
   minutes: z.number().int().min(1).max(180).default(15),
   goal: studyGoalSchema.default('learn'),
   cardIds: z.array(idSchema).max(MAX_CARDS_PER_DECK).optional(),
});

/** Session snapshot inputs (SPEC §9.8, [R6]). */
export const mcpGetStudySessionInputSchema = z.object({ sessionId: idSchema });

/**
 * `render_study_session` starts or resumes a session and returns the widget in
 * the same call. ChatGPT's mobile clients drop a UI-linked tool that follows
 * another tool in the same turn, so rendering must not depend on a preceding
 * `start_study_session`.
 */
export const mcpRenderStudySessionInputSchema = z.object({
   sessionId: idSchema.optional(),
   deckId: idSchema.optional(),
   mode: studyModeSchema.default('flashcards'),
   goal: studyGoalSchema.default('learn'),
   minutes: z.number().int().min(1).max(180).default(15),
   cardIds: z.array(idSchema).max(MAX_CARDS_PER_DECK).optional(),
});

/** Audit record written for every MCP write (SPEC §9.7). */
export const mcpAuditEventSchema = z.object({
   userId: idSchema,
   toolName: mcpToolNameSchema,
   action: z.string(),
   inputSummary: z.record(z.unknown()),
   affectedIds: z.array(idSchema),
   requestId: z.string().nullable(),
   createdAt: isoDateSchema,
});

export type McpAuditEvent = z.infer<typeof mcpAuditEventSchema>;

/**
 * The MCP package depends on this interface rather than on the API or on D1/R2
 * (SPEC §2.3). The API builds the concrete implementation and injects it.
 */
export interface McpServices {
   listDecks(input: z.infer<typeof mcpListInputSchema>): Promise<{
      items: DeckSummary[];
      nextCursor: string | null;
   }>;
   getDeck(
      input: z.infer<typeof mcpGetDeckInputSchema>,
   ): Promise<{ deck: Deck; cards: McpCardSummary[] } | null>;
   searchCards(input: McpSearchCardsInput): Promise<{
      items: McpCardSummary[];
      nextCursor: string | null;
   }>;
   getCard(id: string): Promise<Card | null>;
   getLearningStats(deckId: string): Promise<DeckStats | null>;
   getStudyPlan(input: {
      deckId: string;
      mode: StudyMode;
      minutes: number;
      goal: StudyGoal;
      cardIds?: string[];
   }): Promise<StudyRecommendation>;
   createDeck(input: CreateDeckInput): Promise<Deck>;
   createCards(input: { deckId: string; cards: CreateCardInput[] }): Promise<Card[]>;
   importDeck(input: { deckId: string } & ImportDeckInput): Promise<ImportResult>;
   updateCard(input: { id: string } & UpdateCardInput): Promise<Card | null>;
   deleteCard(id: string): Promise<boolean>;
   startStudySession(input: StartSessionInput): Promise<StudySession>;
   recordReview(input: { sessionId: string } & ReviewEventInput): Promise<ReviewResult>;
   /** [R6] Authoritative study-session snapshot for the MCP Apps widget; null when unknown/not owned. */
   getStudySession(sessionId: string): Promise<StudySessionSnapshot | null>;
   /** [R6] Read an MCP Apps UI resource by its `ui://` URI; null when unknown. */
   readUiResource(uri: string): Promise<McpUiResourceContent | null>;
   recordAudit(event: McpAuditEvent): Promise<void>;
}

/** MCP Apps UI metadata attached to a tool (SPEC §9.8). */
export type McpToolUiMeta = { ui: { resourceUri: string } };

export type McpToolDefinition = {
   name: McpToolName;
   scope: McpScope;
   description: string;
   inputSchema: z.ZodTypeAny;
   meta?: McpToolUiMeta;
};

/** Curated workflow tools (SPEC §9.2, §9.4). */
export const MCP_TOOL_DEFINITIONS: McpToolDefinition[] = [
   {
      name: 'list_decks',
      scope: 'decks:read',
      description: 'List compact deck summaries.',
      inputSchema: mcpListInputSchema,
   },
   {
      name: 'get_deck',
      scope: 'decks:read',
      description: 'Read deck metadata and, optionally, compact cards.',
      inputSchema: mcpGetDeckInputSchema,
   },
   {
      name: 'search_cards',
      scope: 'decks:read',
      description: 'Search and filter cards across decks.',
      inputSchema: mcpSearchCardsInputSchema,
   },
   {
      name: 'get_card',
      scope: 'decks:read',
      description: 'Read one card in full.',
      inputSchema: z.object({ id: idSchema }),
   },
   {
      name: 'get_learning_stats',
      scope: 'stats:read',
      description: 'Read accuracy, due counts, and weak cards for a deck.',
      inputSchema: z.object({ deckId: idSchema }),
   },
   {
      name: 'get_study_plan',
      scope: 'stats:read',
      description:
         'Request a Clef-informed (with scheduler fallback) study plan. Pick the practice style with `mode` (flashcards, multiple_choice, typed, matching, cloze, mixed) and the intent with `goal`; `goal: "cram"` covers every active card regardless of schedule.',
      inputSchema: mcpGetStudyPlanInputSchema,
   },
   {
      name: 'create_deck',
      scope: 'decks:write',
      description:
         'Create a deck. Pass `collectionId` (from a collection the caller owns) to file it under a collection.',
      inputSchema: createDeckInputSchema,
   },
   {
      name: 'create_cards',
      scope: 'decks:write',
      description: `Bulk-create up to ${MAX_CARDS_PER_BULK_CREATE} cards in a deck. A deck holds at most ${MAX_CARDS_PER_DECK} live cards; a call that would exceed the cap fails with the stable code DECK_CARD_LIMIT_EXCEEDED.`,
      inputSchema: mcpCreateCardsInputSchema,
   },
   {
      name: 'import_deck',
      scope: 'decks:write',
      description: `Import cards from CSV, TSV, or JSON (at most ${MAX_IMPORT_ROWS} rows per call). The deck is capped at ${MAX_CARDS_PER_DECK} live cards, so split larger imports across decks or delete cards first; an import that would exceed the cap is rejected as a whole with DECK_CARD_LIMIT_EXCEEDED.`,
      inputSchema: mcpImportDeckInputSchema,
   },
   {
      name: 'update_card',
      scope: 'decks:write',
      description: 'Update one card.',
      inputSchema: mcpUpdateCardInputSchema,
   },
   {
      name: 'delete_card',
      scope: 'decks:write',
      description: 'Soft-delete a card.',
      inputSchema: mcpDeleteCardInputSchema,
   },
   {
      name: 'start_study_session',
      scope: 'study:write',
      description:
         'Start a study session without UI. `mode` supports flashcards, multiple_choice, typed, matching, cloze, and mixed; `goal` supports learn, review, cram, retain, and diagnose. Use `goal: "cram"` to revise every active card and `mode: "matching"` for pair matching. When the user wants to study in chat, call `render_study_session` once instead of this tool followed by a render call.',
      inputSchema: mcpStartSessionInputSchema,
   },
   {
      name: 'record_review',
      scope: 'study:write',
      description: 'Append a review result to a session.',
      inputSchema: mcpRecordReviewInputSchema,
   },
   {
      name: 'get_study_session',
      scope: 'decks:read',
      description: 'Fetch the current authoritative study-session snapshot (no UI).',
      inputSchema: mcpGetStudySessionInputSchema,
   },
   {
      name: 'render_study_session',
      scope: 'study:render',
      description:
         'Render an interactive study session as the MCP Apps widget: pass `deckId` to start a session (plus optional `mode`, `goal`, `minutes`) or `sessionId` to resume one. Call this as the only tool in the turn — mobile ChatGPT clients do not render a widget whose tool follows another tool call, so do not call `start_study_session` first.',
      inputSchema: mcpRenderStudySessionInputSchema,
      meta: { ui: { resourceUri: MCP_STUDY_WIDGET_RESOURCE_URI } },
   },
];
