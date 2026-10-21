# Developer guide

This guide is for people **building, self-hosting, or contributing to**
Takhtabush.

> Just want to study? Start with the [user guide](../user/README.md).

## Start here

| I want to…                               | Read                                                                 |
| ---------------------------------------- | -------------------------------------------------------------------- |
| Put it on Cloudflare                     | [Self-hosting](self-hosting.md)                                      |
| Understand the request flow and packages | [Architecture](architecture.md)                                      |
| Set vars, secrets, and bindings          | [Configuration](configuration.md)                                    |
| Harden a deployment                      | [Security](security.md)                                              |
| Work on the MCP endpoint                 | [MCP internals](mcp.md)                                              |
| Change the scheduler                     | [Scheduler](scheduler.md)                                            |
| Change the UI                            | [Frontend](frontend.md) and [Theming](theming.md)                    |
| Add AI decisions                         | [Clef](clef.md)                                                      |
| Send a patch                             | [Contributing](contributing.md)                                      |
| Look up a route or tool                  | [HTTP API](reference/api.md) and [MCP tools](reference/mcp-tools.md) |

## Local quick start

```bash
pnpm install
pnpm db:migrate:local
pnpm dev
```

The SPA runs on `:5173`, the Worker on `:8787`. In development the magic-link
endpoint returns the token, or set `SETUP_TOKEN` in `.dev.vars` and use
`/setup`.

## What you are building

One Cloudflare Worker serves:

- the Preact SPA as static assets,
- the Hono REST API under `/api/v1`,
- the stateless MCP endpoint at `/mcp`,
- the authenticated R2 media proxy at `/media/*`,
- OAuth discovery and consent under `/oauth/*` and `/.well-known/*`,
- a daily cron cleanup job.

D1 is the system of record. R2 stores binary media. `@caly/shared` owns the
contracts and the deterministic scheduler. `packages/mcp` depends on
`@caly/shared` and an injected `McpServices` interface, never on D1 or R2.

## Repository map

```text
packages/
├── webapp             Preact SPA (static assets)
├── api                Hono API + unified Worker entrypoint
├── mcp                MCP tools, scopes, audit
├── ui                 shared shadcn (Base UI) primitives
├── shared             Zod contracts, domain types, scheduler
├── study-widget       optional MCP Apps study widget
└── worker-kit         binding-agnostic Worker helpers
```

## Checks

```bash
pnpm format:check
pnpm lint
pnpm check-types
pnpm test
pnpm build:all
pnpm docs:build
pnpm knip
pnpm db:migrate:check
```

CI runs the same set.
