# MCP internals

Takhtabush exposes a stateless MCP Streamable HTTP endpoint at `/mcp`. It is a
thin adapter over the same domain modules as the web app.

For the user-facing setup, see [Use an AI assistant](../user/ai-assistant.md).

## Architecture

- `packages/mcp` implements the JSON-RPC handling, tool dispatch, scope checks,
  and audit writes.
- It depends on `@caly/shared` for contracts and on an injected `McpServices`
  interface. It never imports D1 or R2.
- `packages/api/src/services/mcp-services.ts` binds that interface to the
  authenticated user and the API services.
- `packages/api/src/index.ts` resolves the caller, builds the services, and
  delegates.

## Authentication

The endpoint accepts three credential types:

- **API key** — `Authorization: Bearer <key>` or `x-api-key`. Keys are hashed,
  scoped, and optionally expire.
- **Session cookie** — the same `sid` cookie as the web app.
- **OAuth bearer** — issued by `@cloudflare/workers-oauth-provider` for ChatGPT
  and other OAuth clients.

API-key and session requests use the Hono `/mcp` route. OAuth bearers go through
the provider. `/mcp/oauth` is a path-descendant alias.

## Scopes

| Scope          | Allows                                             |
| -------------- | -------------------------------------------------- |
| `decks:read`   | List decks, read cards, fetch a study snapshot     |
| `stats:read`   | Read deck statistics and request a study plan      |
| `decks:write`  | Create, update, delete, and import decks and cards |
| `study:write`  | Start sessions and record reviews                  |
| `media:write`  | Request media upload intents                       |
| `study:render` | List and read the MCP Apps study widget resource   |

`tools/list` returns only the tools covered by the presented grant. A tool call
outside the grant fails with `-32003`. An invalid `x-mcp-scopes` header narrows
to no scopes rather than widening to the key's full grant.

The `resources/list` and `resources/read` calls require `study:render`.

## Tools

The curated tool surface is defined in `packages/shared/src/api/mcp.ts` and
generated into the [MCP tool reference](reference/mcp-tools.md).

Adding a tool touches:

1. the tool name schema,
2. the scope map,
3. the definitions array (description + input schema),
4. the `McpServices` interface,
5. the API binding,
6. the dispatch switch,
7. the write set and audit projection.

The server lists tools from the definitions and enforces the scope map. The
web app’s `/mcp` screen uses the same definitions.

## Audit

Every mutating tool writes a row to `mcp_audit_events`:

- user id,
- tool name and action,
- bounded input summary,
- affected ids,
- request id,
- timestamp.

Large inputs are truncated before storage. The audit write happens after the
mutation; a failed audit is reported, but the mutation is already applied.

## OAuth and ChatGPT

`@cloudflare/workers-oauth-provider` handles discovery, token issuance, CIMD and
DCR, and audience validation. Grants, refresh tokens, and clients live in the
`OAUTH_KV` namespace.

- `/oauth/authorize` renders a consent page backed by the magic-link session.
- Consent uses `__Host-` cookies, so test the flow over HTTPS.
- The issuer and audience follow the request origin. Connect clients to the
  canonical host.

## Local development

`wrangler.dev.jsonc` sets `MCP_DEV_NO_AUTH=true`. With no credential present,
`/mcp` uses the owner account. Set `MCP_DEV_USER_EMAIL` to use another existing
user. A supplied bad key still fails, and the flag is ignored outside
`ENVIRONMENT=development`.

## Code execution

There is no `code` tool and no `codemode:execute` scope in v0.1. The previous
implementation ran in the Worker module scope with normal globals reachable, so
it could not honestly be called a sandbox. Code Mode stays deferred until a real
isolation seam exists.

## Tests

`packages/mcp/src/server.test.ts` exercises the dispatch surface, scope checks,
resource gating, and the widget metadata. `packages/mcp/src/auth.test.ts`
covers scope narrowing. The API’s `/mcp` route is covered in
`packages/api/src/routes/api-keys.test.ts`.
