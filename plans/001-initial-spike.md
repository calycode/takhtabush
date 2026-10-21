# Plan 001 — Unified Worker tracer bullet

Goal: a working monorepo that proves the risky parts end-to-end before breadth.

## Steps

1. pnpm workspace + Turborepo + root tooling (ESLint, Prettier, Knip, Husky, Vitest).
2. `@caly/webapp`: Vite + Preact + Tailwind v4 with the D2 aliasing applied verbatim.
3. `preact-iso` route shell (plain anchors — no `Link`).
4. `@caly/ui`: shadcn monorepo aliases; button, card, dialog + simple primitives.
5. `@caly/shared`: Zod contracts + versioned scheduler + tests.
6. D1 migrations (`0001_init`, `0002_indexes`).
7. `@caly/api`: Hono routes, services, repositories, D1, R2, AI, and the unified
   Worker entrypoint (API + `/mcp` + `/media` + assets).
8. `@caly/mcp`: stateless handler, curated tools, scopes, audit.
9. CI quality gates + single-Worker deploy.

## Done when

`pnpm dev` runs the SPA and the unified Worker; `pnpm build:all` produces
Worker-compatible output; `pnpm lint && pnpm check-types && pnpm test &&
pnpm build:all && pnpm knip && pnpm db:migrate:check` pass.
