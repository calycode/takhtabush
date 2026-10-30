# Self-hosting

The app is one Cloudflare Worker with D1, R2, Email Service, Workers AI, and a
daily cron trigger. For the values below, see [Configuration](configuration.md);
for the hardening checklist, see [Security](security.md).

| File                 | Purpose                                                                                                                                                    |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `wrangler.jsonc`     | Production. Used by Appflare repo installs, Cloudflare's Deploy to Cloudflare button, and `wrangler deploy`. D1/R2 have no ids so they can be provisioned. |
| `wrangler.dev.jsonc` | Local `wrangler dev`; contains development defaults.                                                                                                       |

`pnpm build` builds only the static assets (SPA + MCP widget). Use
`pnpm build:all` when you also want to validate the Worker bundle locally.

## Route 1: Appflare repository install (primary)

This works with a public or private GitHub repository. Private repositories need
a fine-grained GitHub token.

### Prerequisites

- Workers Paid (sandbox builds run in Cloudflare Containers).
- R2 enabled in the Cloudflare account.
- Appflare manager installed.
- **Settings → Building apps → Build in your account → Enable sandbox builds**.
- The Appflare API token has **Containers: Edit**.
- For a private repo: **Settings → Building apps → GitHub access → Add token**
  with a fine-grained PAT that has:
   - **Contents: Read-only**
   - **Metadata: Read-only**
   - Only the repository being installed
   - An expiry

Appflare stores the GitHub token on its sandbox Worker; the build commands do
not see it.

### Install

1. Push the repository to GitHub.
2. In Appflare: **Catalog → From a repository**.
3. Enter `owner/repo`, the branch or commit, and the build command:

   ```bash
   pnpm build
   ```

   **Work it out** is fine too: it runs the root `package.json` `build` script,
   which builds only the assets the packer needs.

4. Build for review.
5. Confirm in the review that Appflare will create D1 `DB`, R2 `MEDIA`, the
   `OAUTH_KV`/`CACHE` KV namespaces, the `EMAIL`/`AI`/`ASSETS` bindings, the cron
   trigger, and the migrations.
6. Install with:
   - Worker name: `takhtabush` or your choice
   - `SESSION_SECRET`: generate a long random value
   - `SETUP_TOKEN`: generate another long random value
   - `OWNER_EMAIL`: optional
   - `ALLOWED_EMAILS`: empty for strict single-user
   - `EMAIL_FROM`: empty for now
7. Appflare creates D1 `<worker-name>-DB`, R2 `<worker-name>-MEDIA`, and both KV
   namespaces, uploads the Worker, applies `migrations/`, and runs the health
   check.

Repo installs are marked **Not from the catalog, not checked** and are not
updated automatically. Use **Check for changes → Rebuild and update** when you
want to move to a new commit.

### First-run setup

Open `https://<app>/setup` and enter the owner email plus the `SETUP_TOKEN` from
the install form. That creates the owner account without email delivery.

Then open `/mcp` to create an API key for MCP clients. For ChatGPT, add
`https://<app>/mcp` as a custom MCP server and choose OAuth; the same endpoint
accepts API keys, and OAuth requests redirect to the existing sign-in and
consent flow. `https://<app>/mcp/oauth` also works as an alias.

## Route 2: Deploy to Cloudflare button

The button clones the repository into your GitHub account and uses Workers
Builds. Cloudflare reads the root `wrangler.jsonc`, provisions the D1 database,
R2 bucket, and the `OAUTH_KV`/`CACHE` KV namespaces, and deploys the Worker.

1. Build the SPA before pushing (or let the Workers Builds command do it):
   `pnpm build`.
2. Deploy with the button.
3. Set the secrets in the Cloudflare dashboard (or with `wrangler secret put`)
   after the first deploy:
   - `SESSION_SECRET`
   - `SETUP_TOKEN`
   - optional: `OWNER_INVITE_TOKEN`, `AI_GATEWAY_TOKEN`
4. Apply migrations once the D1 database exists:

   ```bash
   wrangler d1 migrations apply DB --remote --config wrangler.jsonc
   ```

   If Wrangler cannot resolve the auto-provisioned database, copy its name or id
   from the dashboard and use that instead of `DB`.

5. Open `/setup` and create the owner.

## Route 3: Manual `wrangler deploy`

Wrangler 4.57+ can auto-provision missing D1/R2/KV resources on deploy. If you
prefer explicit resources, create them first and fill in their ids.

```bash
# Option A: let Wrangler provision on deploy
pnpm deploy

# Option B: create explicitly first
wrangler d1 create takhtabush
wrangler r2 bucket create takhtabush-media
wrangler kv namespace create OAUTH_KV
wrangler kv namespace create CACHE
# then add database_id, bucket_name, and both kv namespace ids to wrangler.jsonc
pnpm deploy
```

Then set the secrets and apply migrations:

```bash
wrangler secret put SESSION_SECRET --config wrangler.jsonc
wrangler secret put SETUP_TOKEN --config wrangler.jsonc
# optional:
wrangler secret put OWNER_INVITE_TOKEN --config wrangler.jsonc
wrangler secret put AI_GATEWAY_TOKEN --config wrangler.jsonc

wrangler d1 migrations apply DB --remote --config wrangler.jsonc
```

Finally open `/setup` and create the owner.

## Variables and secrets

Production vars live in `wrangler.jsonc`:

- `APP_URL` — empty means “use the request origin”. Set it to pin a custom
  domain.
- `ENVIRONMENT` — must remain `production`.
- `EMAIL_FROM` — empty until a sender domain is onboarded.
- `OWNER_EMAIL` — optional; pins the owner address.
- `ALLOWED_EMAILS` — optional comma-separated allowlist.
- `AI_GATEWAY_URL`, `CLEF_MODEL` — optional Clef settings.

Secrets:

- `SESSION_SECRET` — required.
- `SETUP_TOKEN` — required for `/setup` and owner recovery.
- `OWNER_INVITE_TOKEN` — optional extra magic-link gate.
- `AI_GATEWAY_TOKEN` — optional.

`.dev.vars.example` is the Appflare/Cloudflare install form’s secret list. It is
not the local development config; `wrangler.dev.jsonc` has local defaults.

## First-run and recovery

`GET /api/v1/auth/status` returns:

```json
{ "initialized": false, "setupRequired": true, "setupEnabled": true }
```

`POST /api/v1/auth/setup` accepts `{ "email", "token" }` and:

- creates the owner when no users exist; or
- signs the existing owner in when the email matches and `SETUP_TOKEN` is set.

It is rate limited per IP and disabled when `SETUP_TOKEN` is unset.

## Single tenancy

- The first user becomes `is_owner`.
- `migrations/0007_single_owner.sql` allows at most one owner row.
- After initialization, only the owner can request a magic link unless the
  address is in `ALLOWED_EMAILS`.
- `OWNER_EMAIL`, when set, is the only address allowed to own or recover the
  deployment.

## Email

Cloudflare Email Service needs an onboarded sender domain before magic links can
be delivered. Until then, `/setup` and `/setup` recovery work without email.
After onboarding a domain, set `EMAIL_FROM` in the app settings and redeploy or
save the settings.

## Appflare catalog (later)

The public catalog needs a public repository, a license, and at least 50 GitHub
stars. `deploy/appflare.jsonc` is a draft of the catalog entry; it points at
`wrangler.jsonc`, runs `pnpm build`, and provisions D1/R2. Fill `repo`,
`authors`, `maintainers`, and the full `source.sha` before submitting it to
`appflare/catalog`.

## Smoke tests

```bash
curl -fsS https://<app>/api/v1/health
curl -fsS https://<app>/api/v1/auth/status
curl -fsS https://<app>/mcp-apps/study-session/v1.html
curl -fsS https://<app>/.well-known/oauth-protected-resource
curl -fsS https://<app>/.well-known/oauth-protected-resource/mcp
```

Then verify:

- `/setup` creates the owner exactly once.
- `/login` accepts the owner email and rejects a new unlisted email.
- `/mcp` creates an API key and `POST /mcp` accepts it.
- `/mcp` returns an OAuth challenge when no API key or session is supplied, and
  ChatGPT can complete the sign-in/consent flow.
- A deck can be created, studied, and appears in stats.
