# Contributing to Takhtabush

Thanks for helping. This is a small codebase with strong conventions; reading
this file first will save you a review round-trip.

## Requirements

- Node 22+
- pnpm 10+
- A Cloudflare account only for deployment. Local development uses Wrangler's
  local D1/R2 emulation.

## Setup

```bash
pnpm install
pnpm db:migrate:local
pnpm dev
```

The SPA runs on `:5173` and the unified Worker on `:8787`. In development the
magic-link endpoint returns the sign-in token, so you do not need a mailbox.
See [`.dev.vars.example`](./.dev.vars.example) for the secret names a real
deployment uses.

## Checks

Run these before opening a pull request:

```bash
pnpm format:check
pnpm lint
pnpm check-types
pnpm test
pnpm build:all
pnpm knip
pnpm db:migrate:check
```

`pnpm format` fixes formatting. CI runs the same set.

## Where things live

- `packages/webapp` — Preact SPA. Routes are declared explicitly in `App.tsx`.
- `packages/api` — Hono routes, services, repositories, and the Worker entrypoint.
- `packages/mcp` — stateless MCP handler. It may depend on `@caly/shared`, never on D1/R2.
- `packages/shared` — Zod contracts, domain types, scheduler, grading, markdown.
- `packages/ui` — shared shadcn (Base UI) primitives and study presentation.
- `packages/worker-kit` — binding-agnostic Worker helpers.
- `packages/study-widget` — the optional MCP Apps study widget.

Read [`CONTEXT.md`](./CONTEXT.md) for the domain language and
[`docs/architecture.md`](./docs/architecture.md) for the request flow.

## Making a change

1. Keep route handlers thin. Business logic belongs in `services/`, data access
   in `repositories/`.
2. Validate every external input with a Zod schema from `@caly/shared`.
3. Enforce ownership in the service or, better, through an owner-scoped read.
   Never trust a client-supplied owner or workspace id.
4. Add a test at the seam you changed. Pure domain modules in `shared` are the
   cheapest place to start; route tests are welcome when behavior crosses HTTP.
5. Update the contract and the consumers together. A schema change without the
   webapp change is an incomplete change.
6. Add a changeset for user-visible changes with `pnpm changeset` and commit the
   generated `.changeset/*.md` file. See [Versioning and changelogs](#versioning-and-changelogs).

### Versioning and changelogs

Changesets tracks versions and changelogs. All `@caly/*` packages share one
fixed version, so a single changeset bumps the whole product together.

```bash
pnpm changeset        # record a change and choose patch/minor/major
pnpm changeset:status # inspect pending changesets
pnpm version-packages # apply changesets, bump versions, update CHANGELOG.md
```

- Use `patch` for fixes, `minor` for features, and `major` for breaking changes.
- Tooling-only, test-only, and docs-only changes do not need a changeset.
- Do not edit package versions or generated `CHANGELOG.md` files by hand.
- The packages are private and are never published to npm. Do not run
  `changeset publish`.
- The configuration lives in [`.changeset/config.json`](./.changeset/config.json).

### Database changes

Add a numbered SQL file in `migrations/`. Do not edit an applied migration.
Run `pnpm db:migrate:local` and `pnpm db:migrate:check` before committing.

### Scheduler changes

The scheduler is deterministic and versioned. If the math changes, bump
`SCHEDULER_VERSION` in `packages/shared/src/domain/scheduler.ts` and add a
test that pins the new behavior. Learning state is rebuildable from review
events; do not add a migration that rewrites history.

### MCP changes

MCP tools are curated. A tool change usually touches the name, the input
schema, the scope mapping, the definitions list, the `McpServices` interface,
the API binding, and the dispatch switch. Update the scope tests too. Keep the
package free of D1/R2 imports.

### Study widget changes

The widget is inlined into a generated TypeScript module. After editing
`packages/study-widget/src`, run:

```bash
pnpm --filter @caly/study-widget build
```

Commit the regenerated `packages/study-widget/compiled/v1.html.ts`, or the
Worker will keep serving the old bundle.

## Frontend conventions

- React imports resolve to `preact/compat` through both Vite and TypeScript.
  Do not add `react` or `react-dom` as runtime dependencies.
- `preact-iso` has no `Link` export. Use plain `<a>` elements and
  `useLocation().route(path)` for programmatic navigation.
- Generate shadcn components into `packages/ui`, never into the webapp.
- Import primitives as `@caly/ui/components/*`.

## Commits and pull requests

Use conventional commit prefixes (`feat:`, `fix:`, `docs:`, `refactor:`,
`test:`, `chore:`). Keep a pull request focused. Describe the behavior change,
the tests you ran, and any migration or deployment note. Include the changeset
for user-visible changes and fill in the pull request template.

## Licensing

Contributions are accepted under the MIT license. There is no CLA: by opening a
pull request you confirm you have the right to contribute the code under the
same terms as the project.
