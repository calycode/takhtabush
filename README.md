<p align="center">
  <img src="docs/_media/logo.png" width="96" height="96" alt="Takhtabush logo" />
</p>

# Takhtabush

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![CI](https://github.com/calycode/takhtabush/actions/workflows/ci.yml/badge.svg)](https://github.com/calycode/takhtabush/actions/workflows/ci.yml)

A self-hosted, lightweight Quizlet-like learning app deployed as **one
Cloudflare Worker**. Create, import, organize, study, and analyze flashcards.

Takhtabush is the Arabic name for the tablinum: the study in a Roman house, the
room for records and learning. This is the digital equivalent — one small,
private place for your decks.

- **Webapp** — Preact + Vite SPA served as static assets, routed with `preact-iso`.
- **API** — [Hono](https://hono.dev) under `/api/v1`, backed by Cloudflare D1.
- **Media** — R2-backed uploads with an authenticated read proxy at `/media/*`.
- **MCP** — a stateless Streamable HTTP endpoint at `/mcp` for coding agents.
- **Clef** — optional AI Gateway decision layer that falls back to a
  deterministic, versioned scheduler.
- **Shared UI** — shadcn/ui (Base UI) primitives generated into `packages/ui`.

Read the [documentation](./docs/README.md) for setup, deployment, study modes,
MCP, security, and the generated API reference. See [`SPEC.md`](./SPEC.md) for
the full design and decision log, and [`AGENTS.md`](./AGENTS.md) before making
changes.

## Screenshots

![Takhtabush dashboard](docs/_media/screenshots/dashboard.png)

| Deck                                           | Study                                               |
| ---------------------------------------------- | --------------------------------------------------- |
| ![Deck view](docs/_media/screenshots/deck.png) | ![Study session](docs/_media/screenshots/study.png) |

![Study statistics](docs/_media/screenshots/stats.png)

## Requirements

- Node 22+
- pnpm 10+
- A Cloudflare account (only to deploy). Appflare repository installs also need
  Workers Paid and R2 enabled for sandbox builds.

## Quick start

```bash
pnpm install
pnpm db:migrate:local   # create the D1 schema locally
pnpm dev                # SPA on :5173, unified Worker on :8787
```

Other scripts:

```bash
pnpm build              # build the SPA + MCP widget assets
pnpm build:all          # build assets and validate the Worker bundle
pnpm lint
pnpm check-types
pnpm test
pnpm knip
pnpm db:migrate:check
pnpm deploy             # build assets, then deploy with wrangler.jsonc
pnpm docs:dev           # build and serve the static docs on :3030
pnpm docs:build         # static docs + landing page in docs-site/
pnpm docs:preview       # serve docs-site/ on :3031
```

Local development uses `wrangler.dev.jsonc`; production, Appflare repository
installs, and Cloudflare's Deploy to Cloudflare button use the root
`wrangler.jsonc`. See [`docs/developer/self-hosting.md`](./docs/developer/self-hosting.md)
for the production checklist, first-run setup, single-tenancy policy, and
Appflare catalog packaging.

Deployment routes:

1. **Appflare repository install** (primary; public or private repo).
2. **Deploy to Cloudflare button**:
   `https://deploy.workers.cloudflare.com/?url=https://github.com/<owner>/<repo>`
   (replace `<owner>/<repo>` after pushing).
3. **Manual**: `pnpm deploy` after setting the secrets.

## Authentication

Sign-in is a session-based email magic link (`POST /api/v1/auth/magic-link`
then `/api/v1/auth/verify`), backed by secure HTTP-only cookies plus a
double-submit CSRF cookie for browser mutations.

- Email is delivered through the **Cloudflare Email Service** `EMAIL` binding
  (`send_email` in `wrangler.jsonc`). `wrangler dev` simulates delivery and logs
  the message; a deployed Worker sends from `EMAIL_FROM` (an onboarded domain).
- **Local development** (`wrangler.dev.jsonc`, `ENVIRONMENT=development`): the
  API also returns the raw magic-link token, so sign-in works with no mailbox.
  The login screen surfaces an "Open sign-in link" shortcut.
- **Production** (`wrangler.jsonc`, `ENVIRONMENT=production`): the raw token is
  never returned and a successful `EMAIL` send is required (`502` otherwise).
- **Single-user gate** (optional): set `OWNER_INVITE_TOKEN`; every sign-in
  request must then include a matching `invite` value.
- **Single tenancy** (default): the first user becomes the owner. After that,
  only the owner can sign in unless additional addresses are listed in
  `ALLOWED_EMAILS` (comma-separated). Set `OWNER_EMAIL` to pin the owner address
  from the start.
- **First-run setup**: set `SETUP_TOKEN` to enable `/setup`, which creates the
  owner account without sending email and later recovers owner access. A catalog
  install can therefore be set up before its sender domain is ready.

The first user to sign in is marked `is_owner`. Active sessions are listed on
the settings screen and can be revoked individually or all-at-once
(`GET /api/v1/sessions`, `DELETE /api/v1/sessions/:id`, `DELETE /api/v1/sessions`).

### MCP access

MCP clients authenticate with an **API key** created on the `/mcp` screen
(`Authorization: Bearer <key>` or `x-api-key: <key>`), so a client only needs a
URL plus one header. Keys are scoped to a subset of
`decks:read`, `stats:read`, `decks:write`, `study:write`, `media:write`,
`study:render`; the secret is shown once and stored only as a hash.

**Local testing:** `wrangler.dev.jsonc` sets `MCP_DEV_NO_AUTH=true`. With no
credential present, `/mcp` uses the owner account. Sign in once locally, or set
`MCP_DEV_USER_EMAIL` to another existing user. Supplying a bad API key still
fails, and the flag is ignored unless `ENVIRONMENT=development`.

### ChatGPT / OAuth

ChatGPT's web connector does not send static API-key headers. The `/mcp`
endpoint supports both auth models: API keys/session cookies keep using the
Hono route, while OAuth bearers go through the provider. `/mcp/oauth` is also
accepted as an alias.

1. In ChatGPT, open **Plugins → Add custom MCP server**.
2. Set the server URL to `https://<app>/mcp`.
3. Choose **OAuth** and leave the client ID/secret blank. ChatGPT uses CIMD;
   `/oauth/register` is available as a DCR fallback.
4. Sign in with the existing magic-link flow and approve the scopes on the
   consent page.

ChatGPT issues its own tokens through `@cloudflare/workers-oauth-provider`, and
their grants, refresh tokens, and registered clients live in the `OAUTH_KV`
namespace. Tokens are scoped to the same MCP scopes as API keys. The same
`/mcp` endpoint continues to accept API keys for Codex, Claude Desktop, and
scripts.

Use the canonical public HTTPS origin when adding the connector: the OAuth
issuer and token audience follow the request origin, so connecting through a
different hostname creates a separate audience. `APP_URL` still controls the
host used in magic-link emails. OAuth consent uses `__Host-` cookies, so test
the full flow over HTTPS (`wrangler dev --local-protocol https` or a tunnel)
rather than plain HTTP.

## Layout

```text
migrations/            D1 migrations
packages/
├── webapp             Preact SPA (static assets)
├── api                Hono API + unified Worker entrypoint
├── mcp                MCP tools, scopes, audit
├── ui                 shared shadcn (Base UI) primitives
├── shared             Zod contracts, domain types, scheduler
└── worker-kit         binding-agnostic Worker helpers
```

## Conventions

- React imports resolve to `preact/compat` via **both** Vite and `tsconfig`.
- Never add `react` / `react-dom` as runtime dependencies.
- Generate shadcn components into `packages/ui`, never into the webapp.
- `preact-iso` has **no `Link` export** — use plain `<a>` elements.
- Validate all input with `@caly/shared` Zod schemas; keep handlers thin.
- Every user-visible change needs a changeset (`pnpm changeset`); all `@caly/*` packages share one fixed version.

## Documentation

The docs source lives in [`docs/`](./docs/README.md). The site is built from
Markdown into `docs-site/` with a two-path landing page, sidebar, search, theme
toggle, raw-Markdown mirrors, and a sitemap. The MCP tool and HTTP route
reference pages are generated from the code.

- **User guide** — [start here](./docs/user/README.md)
   - [Getting started](./docs/user/getting-started.md)
   - [Decks and cards](./docs/user/decks-and-cards.md)
   - [Studying](./docs/user/studying.md)
   - [Progress](./docs/user/progress.md)
   - [Use an AI assistant](./docs/user/ai-assistant.md)
- **Developer guide** — [start here](./docs/developer/README.md)
   - [Self-hosting](./docs/developer/self-hosting.md)
   - [Architecture](./docs/developer/architecture.md)
   - [Configuration](./docs/developer/configuration.md)
   - [Security](./docs/developer/security.md)
   - [MCP internals](./docs/developer/mcp.md)
   - [Scheduler](./docs/developer/scheduler.md)
   - [HTTP API reference](./docs/developer/reference/api.md)

The GitHub Pages workflow builds and deploys `docs-site/` on changes to `docs/`
or the docs scripts. For a custom domain, set `DOCS_BASE` (empty for root) and
`DOCS_SITE_URL` in the workflow.

## Contributing

Issues and pull requests are welcome. Start with
[`CONTRIBUTING.md`](./CONTRIBUTING.md) for setup, architecture pointers, and
the checks a pull request must pass. By participating you agree to the
[Code of Conduct](./CODE_OF_CONDUCT.md).

## Security

Please do not open a public issue for a vulnerability. Use GitHub's private
vulnerability reporting; see [`SECURITY.md`](./SECURITY.md) for scope and
response expectations. Self-hosted deployments are responsible for their own
secrets, DNS, and Cloudflare account.

## License

[MIT](./LICENSE) © 2026 Mihály Tóth. You may self-host, modify, and redistribute
this project, including commercially, provided the copyright notice and
permission notice are retained.
