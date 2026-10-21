import {
   MCP_TOOL_DEFINITIONS,
   MCP_TOOL_SCOPES,
   createDeckInputSchema,
   idSchema,
   mcpCreateCardsInputSchema,
   mcpDeleteCardInputSchema,
   mcpGetDeckInputSchema,
   mcpGetStudyPlanInputSchema,
   mcpGetStudySessionInputSchema,
   mcpImportDeckInputSchema,
   mcpListInputSchema,
   mcpRecordReviewInputSchema,
   mcpSearchCardsInputSchema,
   mcpStartSessionInputSchema,
   mcpUpdateCardInputSchema,
   type McpServices,
   type McpToolName,
   type McpScope,
} from '@caly/shared';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { McpError, McpToolError, missingScope } from './errors';

export type ToolContext = {
   services: McpServices;
   userId: string;
   scopes: McpScope[];
   requestId: string | null;
};

const GET_CARD_INPUT = z.object({ id: idSchema });
const GET_STATS_INPUT = z.object({ deckId: idSchema });

const WRITE_TOOLS: ReadonlySet<McpToolName> = new Set([
   'create_deck',
   'create_cards',
   'import_deck',
   'update_card',
   'delete_card',
   'start_study_session',
   'record_review',
]);

function affectedIdsOf(output: unknown): string[] {
   if (Array.isArray(output)) {
      return output
         .map((item) => (item as { id?: unknown })?.id)
         .filter((id): id is string => typeof id === 'string');
   }
   if (!output || typeof output !== 'object') return [];
   const record = output as Record<string, unknown>;
   if (typeof record.id === 'string') return [record.id];
   const event = record.event;
   if (event && typeof event === 'object') {
      const eventId = (event as { id?: unknown }).id;
      if (typeof eventId === 'string') return [eventId];
   }
   return [];
}

/** Keep audit rows useful without storing an entire import or source body. */
function summarizeInput(args: unknown): Record<string, unknown> {
   if (!args || typeof args !== 'object' || Array.isArray(args)) return {};
   const record = args as Record<string, unknown>;
   const json = JSON.stringify(record);
   if (json.length <= 2000) return record;
   return { truncated: true, preview: json.slice(0, 2000) };
}

/** List only the tool descriptors the caller's scopes allow (SPEC §9.4). */
export function listTools(scopes: McpScope[]) {
   return MCP_TOOL_DEFINITIONS.filter((tool) => scopes.includes(tool.scope)).map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: zodToJsonSchema(tool.inputSchema, {
         target: 'jsonSchema7',
         $refStrategy: 'none',
      }),
      // MCP Apps: only render tools declare a UI resource (SPEC §9.8).
      ...(tool.meta ? { _meta: tool.meta } : {}),
   }));
}

/** UI metadata for a tool result, when the tool declares an MCP Apps resource. */
export function toolResultMeta(name: McpToolName) {
   return MCP_TOOL_DEFINITIONS.find((tool) => tool.name === name)?.meta;
}

/**
 * Dispatch a tool call against the injected services. Enforces the required
 * scope and writes an audit record for every mutating tool (SPEC §9.3, §9.7).
 */
export async function callTool(
   name: McpToolName,
   args: unknown,
   ctx: ToolContext,
): Promise<unknown> {
   const scope = MCP_TOOL_SCOPES[name];
   if (!ctx.scopes.includes(scope)) throw missingScope(scope);

   let output: unknown;

   switch (name) {
      case 'list_decks':
         output = await ctx.services.listDecks(mcpListInputSchema.parse(args));
         break;
      case 'get_deck':
         output = await ctx.services.getDeck(mcpGetDeckInputSchema.parse(args));
         break;
      case 'search_cards':
         output = await ctx.services.searchCards(mcpSearchCardsInputSchema.parse(args));
         break;
      case 'get_card': {
         const { id } = GET_CARD_INPUT.parse(args);
         output = await ctx.services.getCard(id);
         break;
      }
      case 'get_learning_stats': {
         const { deckId } = GET_STATS_INPUT.parse(args);
         output = await ctx.services.getLearningStats(deckId);
         break;
      }
      case 'get_study_plan':
         output = await ctx.services.getStudyPlan(mcpGetStudyPlanInputSchema.parse(args));
         break;
      case 'create_deck':
         output = await ctx.services.createDeck(createDeckInputSchema.parse(args));
         break;
      case 'create_cards':
         output = await ctx.services.createCards(mcpCreateCardsInputSchema.parse(args));
         break;
      case 'import_deck':
         output = await ctx.services.importDeck(mcpImportDeckInputSchema.parse(args));
         break;
      case 'update_card':
         output = await ctx.services.updateCard(mcpUpdateCardInputSchema.parse(args));
         break;
      case 'delete_card': {
         const { id } = mcpDeleteCardInputSchema.parse(args);
         output = { id, deleted: await ctx.services.deleteCard(id) };
         break;
      }
      case 'start_study_session':
         output = await ctx.services.startStudySession(mcpStartSessionInputSchema.parse(args));
         break;
      case 'record_review':
         output = await ctx.services.recordReview(mcpRecordReviewInputSchema.parse(args));
         break;
      case 'get_study_session':
      case 'render_study_session': {
         const { sessionId } = mcpGetStudySessionInputSchema.parse(args);
         const snapshot = await ctx.services.getStudySession(sessionId);
         if (!snapshot) throw new McpToolError('Study session not found.');
         output = snapshot;
         break;
      }
      default:
         throw new McpError(-32602, `Unknown tool: ${String(name)}`);
   }

   if (WRITE_TOOLS.has(name)) {
      await ctx.services.recordAudit({
         userId: ctx.userId,
         toolName: name,
         action: name,
         inputSummary: summarizeInput(args),
         affectedIds: affectedIdsOf(output),
         requestId: ctx.requestId,
         createdAt: new Date().toISOString(),
      });
   }

   return output;
}
