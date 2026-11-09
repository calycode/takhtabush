import type { Deck, ImportResult } from '@caly/shared';
import type { Connection } from './connection';
import { AppError } from './errors';

type ToolResult = {
   structuredContent?: unknown;
   isError?: boolean;
   content?: Array<{ type?: string; text?: string }>;
};

type JsonRpcResponse = {
   result?: ToolResult;
   error?: { code?: number; message?: string };
};

function toolErrorMessage(result: ToolResult): string {
   const text =
      result.content
         ?.map((part) => part.text)
         .filter((value): value is string => Boolean(value))
         .join('\n') ?? '';
   return text || 'Takhtabush rejected the request.';
}

async function callTool<T>(
   connection: Connection,
   name: string,
   args: Record<string, unknown>,
): Promise<T> {
   let response: Response;
   try {
      response = await fetch(`${connection.origin}/mcp`, {
         method: 'POST',
         headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${connection.token}`,
         },
         body: JSON.stringify({
            jsonrpc: '2.0',
            id: crypto.randomUUID(),
            method: 'tools/call',
            params: { name, arguments: args },
         }),
      });
   } catch {
      throw new AppError(
         'NETWORK',
         `Could not reach ${connection.origin}. Check the URL and the extension's site access.`,
      );
   }

   if (response.status === 401 || response.status === 403) {
      throw new AppError(
         'AUTH_FAILED',
         'Takhtabush rejected the extension connection. Reconnect from the extension settings.',
      );
   }
   if (!response.ok) {
      throw new AppError('HTTP_ERROR', `Takhtabush returned HTTP ${response.status}.`);
   }

   const payload = (await response.json().catch(() => null)) as JsonRpcResponse | null;
   if (!payload) {
      throw new AppError('BAD_RESPONSE', 'Takhtabush returned an unreadable response.');
   }
   if (payload.error) {
      throw new AppError('MCP_ERROR', payload.error.message ?? 'Takhtabush rejected the request.');
   }

   const result = payload.result;
   if (!result) {
      throw new AppError('BAD_RESPONSE', 'Takhtabush returned an empty response.');
   }
   if (result.isError) {
      const text = toolErrorMessage(result);
      const match = text.match(/^([A-Z0-9_]+):\s*([\s\S]*)$/);
      throw new AppError(match?.[1] ?? 'MCP_TOOL_ERROR', match?.[2] ?? text);
   }

   return result.structuredContent as T;
}

/** Confirm the stored key can read decks before saving it. */
export async function verifyConnection(connection: Connection): Promise<void> {
   await callTool(connection, 'list_decks', { limit: 1 });
}

export function createDeck(
   connection: Connection,
   input: { title: string; description?: string },
): Promise<Deck> {
   return callTool<Deck>(connection, 'create_deck', input);
}

export function importDeck(
   connection: Connection,
   deckId: string,
   content: string,
): Promise<ImportResult> {
   return callTool<ImportResult>(connection, 'import_deck', {
      deckId,
      format: 'json',
      content,
      hasHeader: false,
      tags: [],
   });
}
