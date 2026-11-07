# @caly/docs

The Takhtabush documentation and landing site, served as a static-assets-only
Cloudflare Worker. There is no Worker script: Cloudflare serves `dist/` directly
and static-asset requests are free.

## Local preview

```bash
pnpm docs:build
pnpm docs:preview
```

`pnpm docs:preview` serves `packages/docs/dist` at
`http://localhost:3031`. The build is written by `scripts/docs/build.ts`; the
Markdown sources and navigation live in `docs/` and `scripts/docs/manifest.ts`.

## Deploy

```bash
pnpm docs:deploy
```

This builds the site and runs `wrangler deploy` from this package. The Worker is
named `takhtabush-docs` and is only reachable at
`https://takhtabush.calycode.com`; the `workers.dev` hostname is disabled in
`wrangler.jsonc`.

CI deploys on pushes to `main` that touch the docs sources. The workflow needs
two repository secrets:

- `CLOUDFLARE_API_TOKEN` — a token with **Workers Scripts: Edit** on the account.
- `CLOUDFLARE_ACCOUNT_ID` — the account id (`fb2dff520469e75f6f1c13544b2052cb`).

Without the token the workflow still builds the site and prints a warning
instead of failing.

## Routing

`wrangler.jsonc` uses:

- `html_handling: "auto-trailing-slash"` so `/docs/user/studying` serves
  `docs/user/studying.html`.
- `not_found_handling: "404-page"` so unknown paths return the generated
  `404.html` with a 404 status.
