import { describe, expect, it, vi } from 'vitest';
import {
   MCP_STUDY_WIDGET_MIME_TYPE,
   MCP_STUDY_WIDGET_RESOURCE_URI,
   type McpServices,
} from '@caly/shared';
import { handleMcpRequest } from './server';

const SNAPSHOT = {
   sessionId: 'stu_1',
   deckId: 'deck_1',
   deckTitle: 'Spanish A1',
   mode: 'flashcards',
   status: 'active',
   total: 0,
   reviewed: 0,
   reviewedCardIds: [],
   cards: [],
   fallbackStudyPath: '/study/stu_1',
};

function stubServices(): McpServices {
   return {
      listDecks: vi.fn(async () => ({ items: [], nextCursor: null })),
      getDeck: vi.fn(async () => null),
      searchCards: vi.fn(async () => ({ items: [], nextCursor: null })),
      getCard: vi.fn(async () => null),
      getLearningStats: vi.fn(async () => null),
      getStudyPlan: vi.fn(async () => ({
         plan: {
            sessionId: 'stu_1',
            mode: 'mixed',
            strategy: 'consolidate',
            estimatedMinutes: 5,
            cardIds: [],
            reasons: {},
            fallbackUsed: false,
         },
         source: 'scheduler',
         evaluationId: null,
      })),
      createDeck: vi.fn(),
      createCards: vi.fn(),
      importDeck: vi.fn(),
      updateCard: vi.fn(),
      deleteCard: vi.fn(),
      startStudySession: vi.fn(),
      recordReview: vi.fn(),
      getStudySession: vi.fn(async (sessionId: string) =>
         sessionId === 'stu_1' ? SNAPSHOT : null,
      ),
      readUiResource: vi.fn(async (uri: string) =>
         uri === MCP_STUDY_WIDGET_RESOURCE_URI
            ? { uri, mimeType: MCP_STUDY_WIDGET_MIME_TYPE, text: '<html></html>' }
            : null,
      ),
      recordAudit: vi.fn(async () => undefined),
   } as unknown as McpServices;
}

function post(body: unknown) {
   return new Request('https://example.com/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
   });
}

const ctx = {
   services: stubServices(),
   userId: 'usr_1',
   scopes: [
      'decks:read',
      'stats:read',
      'decks:write',
      'study:write',
      'media:write',
      'study:render',
   ] as const,
   requestId: 'req_1',
};

describe('mcp server', () => {
   it('initializes', async () => {
      const res = await handleMcpRequest(post({ jsonrpc: '2.0', id: 1, method: 'initialize' }), {
         ...ctx,
         scopes: [...ctx.scopes],
      });
      const body = (await res.json()) as {
         result: { capabilities: { resources?: unknown }; serverInfo: { name: string } };
      };
      expect(body.result.serverInfo.name).toBe('takhtabush');
      expect(body.result.capabilities.resources).toBeDefined();
   });

   it('lists the curated tools', async () => {
      const res = await handleMcpRequest(post({ jsonrpc: '2.0', id: 2, method: 'tools/list' }), {
         ...ctx,
         scopes: [...ctx.scopes],
      });
      const body = (await res.json()) as {
         result: {
            tools: Array<{
               name: string;
               inputSchema?: { properties?: Record<string, unknown> };
               _meta?: { ui?: { resourceUri?: string } };
            }>;
         };
      };
      expect(body.result.tools.map((tool) => tool.name)).toContain('get_study_plan');
      expect(body.result.tools).toHaveLength(15);
      const render = body.result.tools.find((tool) => tool.name === 'render_study_session');
      expect(render?._meta?.ui?.resourceUri).toBe(MCP_STUDY_WIDGET_RESOURCE_URI);
      expect(render?.inputSchema?.properties).toHaveProperty('sessionId');
   });

   it('lists only the tools the caller can invoke', async () => {
      const res = await handleMcpRequest(post({ jsonrpc: '2.0', id: 10, method: 'tools/list' }), {
         ...ctx,
         scopes: ['decks:read'],
      });
      const body = (await res.json()) as { result: { tools: Array<{ name: string }> } };
      const names = body.result.tools.map((tool) => tool.name);
      expect(names).toContain('list_decks');
      expect(names).not.toContain('create_deck');
      expect(names).not.toContain('start_study_session');
   });

   it('lists the MCP Apps study widget resource', async () => {
      const res = await handleMcpRequest(
         post({ jsonrpc: '2.0', id: 6, method: 'resources/list' }),
         { ...ctx, scopes: [...ctx.scopes] },
      );
      const body = (await res.json()) as {
         result: { resources: Array<{ uri: string; mimeType: string }> };
      };
      expect(body.result.resources).toEqual([
         expect.objectContaining({
            uri: MCP_STUDY_WIDGET_RESOURCE_URI,
            mimeType: MCP_STUDY_WIDGET_MIME_TYPE,
         }),
      ]);
   });

   it('reads the MCP Apps study widget resource', async () => {
      const res = await handleMcpRequest(
         post({
            jsonrpc: '2.0',
            id: 7,
            method: 'resources/read',
            params: { uri: MCP_STUDY_WIDGET_RESOURCE_URI },
         }),
         { ...ctx, scopes: [...ctx.scopes] },
      );
      const body = (await res.json()) as {
         result: { contents: Array<{ uri: string; mimeType: string; text: string }> };
      };
      expect(body.result.contents[0]).toEqual({
         uri: MCP_STUDY_WIDGET_RESOURCE_URI,
         mimeType: MCP_STUDY_WIDGET_MIME_TYPE,
         text: '<html></html>',
      });
   });

   it('returns a resource-not-found error for an unknown UI resource', async () => {
      const res = await handleMcpRequest(
         post({
            jsonrpc: '2.0',
            id: 8,
            method: 'resources/read',
            params: { uri: 'ui://takhtabush/missing.html' },
         }),
         { ...ctx, scopes: [...ctx.scopes] },
      );
      const body = (await res.json()) as { error: { code: number } };
      expect(body.error.code).toBe(-32002);
   });

   it('marks render_study_session results with MCP Apps UI metadata', async () => {
      const res = await handleMcpRequest(
         post({
            jsonrpc: '2.0',
            id: 5,
            method: 'tools/call',
            params: { name: 'render_study_session', arguments: { sessionId: 'stu_1' } },
         }),
         { ...ctx, scopes: [...ctx.scopes] },
      );
      const body = (await res.json()) as { result: { _meta?: { ui?: { resourceUri?: string } } } };
      expect(body.result._meta?.ui?.resourceUri).toBe(MCP_STUDY_WIDGET_RESOURCE_URI);
   });

   it('rejects resource reads without the render scope', async () => {
      const res = await handleMcpRequest(
         post({
            jsonrpc: '2.0',
            id: 11,
            method: 'resources/read',
            params: { uri: MCP_STUDY_WIDGET_RESOURCE_URI },
         }),
         { ...ctx, scopes: ['decks:read'] },
      );
      const body = (await res.json()) as { error: { code: number } };
      expect(body.error.code).toBe(-32003);
   });

   it('returns a tool error when the study session is missing', async () => {
      const res = await handleMcpRequest(
         post({
            jsonrpc: '2.0',
            id: 9,
            method: 'tools/call',
            params: { name: 'render_study_session', arguments: { sessionId: 'stu_missing' } },
         }),
         { ...ctx, scopes: [...ctx.scopes] },
      );
      const body = (await res.json()) as {
         result: { isError: boolean; content: Array<{ type: string; text: string }> };
      };
      expect(body.result.isError).toBe(true);
      expect(body.result.content[0]?.text).toContain('not found');
   });

   it('rejects a tool call missing its scope', async () => {
      const res = await handleMcpRequest(
         post({
            jsonrpc: '2.0',
            id: 3,
            method: 'tools/call',
            params: { name: 'create_deck', arguments: { title: 'x' } },
         }),
         { ...ctx, scopes: ['decks:read'] },
      );
      const body = (await res.json()) as { error: { code: number } };
      expect(body.error.code).toBe(-32003);
   });

   it('returns 202 for notifications', async () => {
      const res = await handleMcpRequest(
         post({ jsonrpc: '2.0', method: 'notifications/initialized' }),
         { ...ctx, scopes: [...ctx.scopes] },
      );
      expect(res.status).toBe(202);
   });
});
