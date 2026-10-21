# Contributing

The full guide lives in [`CONTRIBUTING.md`](../../CONTRIBUTING.md). This page is the
short version for people already inside the docs site.

## Setup

```bash
pnpm install
pnpm db:migrate:local
pnpm dev
```

## Checks

```bash
pnpm format:check
pnpm lint
pnpm check-types
pnpm test
pnpm build:all
pnpm knip
pnpm db:migrate:check
pnpm docs:build
```

## Conventions

- Keep route handlers thin; business logic in `services/`, data access in
  `repositories/`.
- Validate external input with Zod schemas from `@caly/shared`.
- Enforce ownership in the service or, better, in an owner-scoped read.
- React imports resolve to `preact/compat` through both Vite and TypeScript.
  Never add `react` or `react-dom` as runtime dependencies.
- Generate shadcn primitives into `packages/ui`, never into the webapp.
- Bump `SCHEDULER_VERSION` when the scheduler math changes.
- A new MCP tool touches the name, schema, scope map, definitions, services
  interface, API binding, and dispatch switch. Update the scope tests too.
- After editing `packages/study-widget/src`, run
  `pnpm --filter @caly/study-widget build` and commit the regenerated
  `compiled/v1.html.ts`.

## Documentation

- Pages live in `docs/` as Markdown.
- `pnpm docs:generate` writes `docs/manifest.json`, `docs/_sidebar.md`, and the
  generated reference pages.
- `pnpm docs:build` renders the static site into `docs-site/`.
- `pnpm docs:dev` builds the static site and serves it on `:3030`.
- `pnpm docs:preview` serves the built static site from `docs-site/`.

When you add a page, add it to the entry list in `scripts/docs/manifest.ts` so
it appears in the sidebar, search, and pager. Generated pages should not be
hand-edited; change the generator instead.

## Screenshots

The screenshots used by the README and the landing page live in
`docs/_media/screenshots/`. Replace them at the same paths to refresh the docs.

## License

Contributions are accepted under the MIT license. There is no CLA.
