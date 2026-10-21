import { mcpScopeSchema, type McpScope } from '@caly/shared';

/**
 * Narrow the `granted` scopes (from the API key) with an optional
 * `x-mcp-scopes` header. Unknown or ungranted scopes are dropped. An absent
 * header leaves the granted set untouched; a header with no valid scope
 * narrows to nothing rather than widening to the granted set.
 */
export function resolveScopes(header: string | null, granted: McpScope[]): McpScope[] {
   if (!header) return granted;
   const requested = header
      .split(',')
      .map((value) => value.trim())
      .filter((value): value is McpScope => mcpScopeSchema.safeParse(value).success);
   if (requested.length === 0) return [];
   return requested.filter((scope) => granted.includes(scope));
}
