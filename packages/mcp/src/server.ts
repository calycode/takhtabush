import {
   MCP_STUDY_WIDGET_RESOURCE,
   mcpToolNameSchema,
   type McpServices,
   type McpScope,
   type StudySessionSnapshot,
} from '@caly/shared';
import { McpError, McpToolError, missingScope } from './errors';
import { callTool, listTools, toolResultMeta } from './tools';

export const MCP_PROTOCOL_VERSION = '2025-06-18';

export type McpContext = {
   services: McpServices;
   userId: string;
   scopes: McpScope[];
   requestId: string | null;
   /** Canonical origin used to make fallback links absolute; defaults to the request URL. */
   baseUrl?: string;
};

type JsonRpcId = string | number | null;
type JsonRpcMessage = { jsonrpc?: string; id?: JsonRpcId; method?: string; params?: unknown };

function requireScope(ctx: McpContext, scope: McpScope) {
   if (!ctx.scopes.includes(scope)) throw missingScope(scope);
}

function result(id: JsonRpcId, value: unknown) {
   return { jsonrpc: '2.0', id: id ?? null, result: value };
}

function error(id: JsonRpcId, code: number, message: string) {
   return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

/**
 * Model-visible text for a tool result. The render tool gets a compact summary
 * plus an absolute link so the user can still study when a host drops the
 * widget (SPEC §9.8 failure table); other tools keep their JSON payload.
 */
function toolText(name: string, output: unknown, baseUrl: string): string {
   if (name === 'render_study_session' && output && typeof output === 'object') {
      const snapshot = output as StudySessionSnapshot;
      if (
         typeof snapshot.sessionId === 'string' &&
         typeof snapshot.fallbackStudyPath === 'string'
      ) {
         const link = `${baseUrl.replace(/\/$/, '')}${snapshot.fallbackStudyPath}`;
         return [
            `Study session ready for ${snapshot.deckTitle}: ${snapshot.reviewed}/${snapshot.total} reviewed, status ${snapshot.status}.`,
            `If the study widget does not render, open the session here: ${link}`,
         ].join('\n');
      }
   }
   return JSON.stringify(output);
}

async function dispatch(message: JsonRpcMessage, ctx: McpContext) {
   const id = message.id ?? null;
   const method = message.method ?? '';

   try {
      switch (method) {
         case 'initialize':
            return result(id, {
               protocolVersion: MCP_PROTOCOL_VERSION,
               capabilities: { tools: {}, resources: {} },
               serverInfo: { name: 'takhtabush', version: '0.1.0' },
            });
         case 'notifications/initialized':
         case 'notifications/cancelled':
            return null;
         case 'ping':
            return result(id, {});
         case 'tools/list':
            return result(id, { tools: listTools(ctx.scopes) });
         case 'resources/list':
            requireScope(ctx, 'study:render');
            return result(id, { resources: [MCP_STUDY_WIDGET_RESOURCE] });
         case 'resources/read': {
            requireScope(ctx, 'study:render');
            const params = (message.params ?? {}) as { uri?: unknown };
            if (typeof params.uri !== 'string' || params.uri.length === 0) {
               throw new McpError(-32602, 'Invalid params: uri is required');
            }
            const content = await ctx.services.readUiResource(params.uri);
            if (!content) throw new McpError(-32002, `Resource not found: ${params.uri}`);
            return result(id, { contents: [content] });
         }
         case 'tools/call': {
            const params = (message.params ?? {}) as { name?: string; arguments?: unknown };
            const name = mcpToolNameSchema.parse(params.name);
            const output = await callTool(name, params.arguments ?? {}, ctx);
            const meta = toolResultMeta(name);
            return result(id, {
               content: [{ type: 'text', text: toolText(name, output, ctx.baseUrl ?? '') }],
               structuredContent: output,
               isError: false,
               // MCP Apps UI linkage for render tools (SPEC §9.8).
               ...(meta ? { _meta: meta } : {}),
            });
         }
         default:
            return error(id, -32601, `Method not found: ${method}`);
      }
   } catch (cause) {
      if (cause instanceof McpToolError) {
         return result(id, {
            content: [{ type: 'text', text: cause.message }],
            isError: true,
         });
      }
      if (cause instanceof McpError) return error(id, cause.code, cause.message);
      return error(id, -32603, cause instanceof Error ? cause.message : 'Internal error');
   }
}

/**
 * Stateless Streamable HTTP MCP endpoint (SPEC §9.1). Accepts a single JSON-RPC
 * message or a batch and returns the responses. Notifications return `202`.
 */
export async function handleMcpRequest(request: Request, ctx: McpContext): Promise<Response> {
   if (request.method !== 'POST') {
      return Response.json(error(null, -32600, 'Only POST is supported'), { status: 405 });
   }

   let body: unknown;
   try {
      body = await request.json();
   } catch {
      return Response.json(error(null, -32700, 'Parse error'));
   }

   const messages = (Array.isArray(body) ? body : [body]) as JsonRpcMessage[];
   const context: McpContext = {
      ...ctx,
      baseUrl: ctx.baseUrl ?? new URL(request.url).origin,
   };
   const responses: unknown[] = [];
   for (const message of messages) {
      const response = await dispatch(message, context);
      if (response) responses.push(response);
   }

   if (responses.length === 0) return new Response(null, { status: 202 });
   return Response.json(Array.isArray(body) ? responses : responses[0]);
}
