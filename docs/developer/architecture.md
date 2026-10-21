# Architecture

One Worker, one deploy. The Worker entrypoint is `packages/api/src/index.ts`;
the build output of `packages/webapp` is mounted as the `ASSETS` binding.

```text
Browser / MCP client
        |
        v
Cloudflare Worker  (packages/api/src/index.ts)
├── Static assets: Preact SPA (packages/webapp/dist/client)
├── /api/v1/*: Hono REST API
├── /mcp: MCP Streamable HTTP endpoint
├── /media/*: authenticated R2 read proxy
└── Bindings: D1 (DB), R2 (MEDIA), AI Gateway / Workers AI (AI), ASSETS
```

## Request flow

1. `logger`, `requestContext`, and `sessionMiddleware` run for every request.
2. `/api/v1/*` gets CORS; `/api/v1/health`, `/api/v1/auth` are public; the rest
   require a session (cookie or bearer) and CSRF for cookie mutations.
3. `/mcp` authenticates, builds an `McpServices` container for the user, and
   delegates to `@caly/mcp`.
4. `/media/:id` checks ownership and streams the R2 object.
5. Anything else falls through to `ASSETS.fetch`, giving SPA deep links.

## Layers

- `routes/` — thin HTTP handlers; parse with shared schemas.
- `services/` — business logic, authorization, and orchestration.
- `repositories/` — D1 access, snake_case rows → camelCase schemas (`lib/map.ts`).
- `lib/` — crypto, validation, errors, cursor, mapping.
- `services/ai/` — the only place AI Gateway / Workers AI is called.
