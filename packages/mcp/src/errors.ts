/** JSON-RPC / MCP errors surfaced to clients with stable codes. */
export class McpError extends Error {
   constructor(
      readonly code: number,
      message: string,
   ) {
      super(message);
      this.name = 'McpError';
   }
}

/** A tool execution failure returned as `{ isError: true }`, not a protocol error. */
export class McpToolError extends Error {
   constructor(message: string) {
      super(message);
      this.name = 'McpToolError';
   }
}

export const missingScope = (scope: string) =>
   new McpError(-32003, `Missing required scope: ${scope}`);
