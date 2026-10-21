# Takhtabush — Context

Takhtabush is a self-hosted, lightweight Quizlet-like learning app
deployed as **one Cloudflare Worker**. A user creates, imports, organizes,
studies, and analyzes flashcard decks.

## Shape

- Preact + Vite SPA on Cloudflare Workers, routed with `preact-iso`.
- Hono API under `/api/v1`, plus a stateless MCP endpoint at `/mcp` and an
  authenticated R2 media proxy at `/media/*`.
- D1 is the system of record; R2 stores binary media only.
- `@caly/shared` owns all contracts and the versioned SM-2-inspired scheduler.
- Clef (via AI Gateway) selects and adapts existing cards; it never generates
  content. AI is optional and degrades to the scheduler.

## Constraints

- Single tenant by default; retain `owner_id` for a future multi-tenant path.
- Review events are append-only; learning state is rebuildable.
- No realtime collaboration, marketplace, billing, or offline sync in V1.
- Keep the Worker count at one; keep MCP free of direct D1/R2 access.

## Notes on this scaffold

- The production Worker config lives at the repo root (`wrangler.jsonc`); local
  development uses `wrangler.dev.jsonc`. The API package is the entrypoint.
- `packages/worker-kit` exists because `@caly/api` consumes the CORS factory,
  envelope helpers, request-context middleware, and id helpers.
- `packages/mcp` depends on the `McpServices` interface from `@caly/shared`, so
  the API injects a concrete implementation and there is no dependency cycle.
