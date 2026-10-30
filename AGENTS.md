# Takhtabush — Agent Guide

## Architecture

- One **unified Cloudflare Worker** serves the SPA assets, `/api/v1/*`, `/mcp`, and `/media/*` (SPEC §2.1, §12.3).
- `packages/webapp` is the Preact SPA (static assets only; no separate Worker).
- `packages/api` is the Hono API **and** the Worker entrypoint (`src/index.ts`). It owns D1, R2, AI, and routing.
- `packages/mcp` is the stateless MCP Streamable HTTP handler. It depends only on `@caly/shared` and the injected `McpServices` — **never** on D1/R2.
- `packages/ui` holds reusable shadcn (Base UI) primitives.
- `packages/shared` holds Zod contracts, domain types, and the versioned scheduler.
- `packages/worker-kit` holds binding-agnostic Worker helpers.

## Routing

- Frontend uses `preact-iso`. There is **no `Link` export** — use plain `<a href>`; for programmatic navigation use `useLocation().route(path)`.
- Do not add React Router.
- Route files are plain module names declared explicitly in `App.tsx`.
- API routes are explicit Hono modules registered in `packages/api/src/routes/index.ts`.

## Preact rules

- React imports resolve to `preact/compat` via BOTH Vite (`vite.config.ts`) and TypeScript (`tsconfig.json` paths). Both layers are mandatory; keep them in sync.
- Never import from `preact/hooks` directly; import from `'react'`.
- Do not add `react` or `react-dom` as runtime dependencies.
- Keep `process.env.IS_PREACT` defined and the Preact preset's built-in React aliases disabled.

## shadcn rules

- Run shadcn from `packages/webapp`.
- Generated primitives land in `packages/ui/src/components`.
- Never create `packages/webapp/src/components/ui`.
- Import primitives as `@caly/ui/components/*`.
- Keep `components.json` design settings aligned between webapp and UI.
- Base UI is unofficial under Preact; smoke-test Dialog / DropdownMenu / Select / Popover / Tabs after adding components (SPEC D12).

## API rules

- Validate all external input with Zod schemas from `packages/shared` (`parse()` in `lib/validation.ts`).
- Keep route handlers thin; business logic in `services/`, data access in `repositories/`.
- Use the response envelope helpers (`ok`, `paginated`, `errorEnvelope`) from `@caly/worker-kit`.
- All timestamps are ISO-8601 strings; all identifiers are prefixed (`deck_…`, `card_…`).
- `review_events` are append-only; `learning_state` is derived and rebuildable from events (SPEC D4).
- Ownership is enforced in services via `owner_id`/`user_id`; never trust client-supplied ownership.
- Bounded-work limits live in `packages/shared/src/domain/limits.ts`. Enforce them in services with the shared constants and stable error codes; never trust the client and never recount `decks.card_count` (reserve slots atomically). Collections are flat; do not add parent ids.

## Scheduler rules

- The scheduler lives in `packages/shared/src/domain/scheduler.ts`, is deterministic and versioned.
- Bump `SCHEDULER_VERSION` whenever the math changes; persist it per `learning_state` row.
- Responses: `again`, `hard`, `good`, `easy`. Daily defaults: 20 new, 200 reviews.
- Grading lives in `packages/shared/src/domain/grading.ts`; auto-graded modes use `gradeFromPerformance` so all four responses can appear.

## Operations

- A daily cron (the Worker's `scheduled` handler) runs `runCleanup` to prune expired/revoked auth artifacts and orphaned R2 media.
- Suspended cards (`cards.status = 'suspended'`) are excluded from automatic sessions and due/new/weak queues.
- Study sessions are listable/resumable; exiting early abandons the session.

## Versioning and changelog

- Every user-visible change ships with a changeset. Run `pnpm changeset`, choose the affected package(s) and bump type, and commit the generated `.changeset/*.md` file with the change. Tooling-only, test-only, and docs-only changes do not need one.
- Agents can skip the interactive prompt with `pnpm changeset --patch @caly/api --message "Short summary"` (use `--minor` or `--major` for other bump types; pass comma-separated packages if needed).
- All `@caly/*` packages are one fixed changeset group. A single changeset bumps the whole product to the same version; never hand-edit package versions.
- `pnpm version-packages` (`changeset version`) consumes pending changesets and writes each package's `CHANGELOG.md`. Do not edit generated changelogs or version fields by hand.
- Packages are private and are never published to npm. Never run `changeset publish`.
- Bump types: `patch` for fixes, `minor` for features, `major` for breaking changes. Pre-1.0 releases still use these three types.
- Inspect pending work with `pnpm changeset:status` (exit code 1 means changed packages are missing a changeset). The config lives in `.changeset/config.json`.

## AI / Clef rules

- Only `packages/api/src/services/ai/*` calls AI Gateway or Workers AI.
- Clef makes decisions over existing cards; it does not generate content (SPEC D5).
- Every AI call degrades gracefully: on failure the deterministic scheduler plan is returned (SPEC §8.3, D11).
- Cache evaluations by input hash + schema version.

## MCP rules

- Curated workflow tools first; the single `code` tool is sandboxed (no D1/R2, no fetch, 5s timeout, 64KB cap).
- Enforce scopes per tool via `MCP_TOOL_SCOPES`.
- Audit every write in `mcp_audit_events`.

## Remote cache

- Turborepo remote cache is opt-in. Never make tasks fail when `TURBO_TOKEN` / `TURBO_TEAM` are unset.

## UI feedback

- Use Agentation during UI development (development only).

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
