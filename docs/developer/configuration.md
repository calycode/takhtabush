# Configuration

The production Worker is configured by `wrangler.jsonc`. Local development uses
`wrangler.dev.jsonc` and optional `.dev.vars` overrides. For the deployment
routes, see [Self-hosting](self-hosting.md).

## Vars

| Name                 | Default                          | Purpose                                                                              |
| -------------------- | -------------------------------- | ------------------------------------------------------------------------------------ |
| `APP_URL`            | empty                            | Public origin used in magic-link emails. Empty means “use the request origin”.       |
| `ENVIRONMENT`        | `production`                     | `development` enables dev-only shortcuts such as returning the magic-link token.     |
| `EMAIL_FROM`         | empty                            | Sender address for the Email Service `EMAIL` binding. Empty disables email delivery. |
| `OWNER_EMAIL`        | empty                            | Pins the only allowed owner address.                                                 |
| `ALLOWED_EMAILS`     | empty                            | Comma-separated allowlist; when set, it is the complete allowlist for new accounts.  |
| `AI_GATEWAY_URL`     | empty                            | Optional AI Gateway endpoint for Clef. Empty falls back to the Workers AI binding.   |
| `CLEF_MODEL`         | `@cf/meta/llama-3.1-8b-instruct` | Model used by Clef.                                                                  |
| `MCP_DEV_NO_AUTH`    | `false`                          | Development-only MCP auth bypass; ignored outside `ENVIRONMENT=development`.         |
| `MCP_DEV_USER_EMAIL` | empty                            | Existing user to impersonate when the dev bypass is on.                              |

## Secrets

Set these with `wrangler secret put` or the Cloudflare dashboard:

| Name                 | Required  | Purpose                                                                              |
| -------------------- | --------- | ------------------------------------------------------------------------------------ |
| `SESSION_SECRET`     | Yes       | Hashes session and magic-link tokens; signs OAuth consent cookies. 32+ random bytes. |
| `SETUP_TOKEN`        | For setup | Enables `/setup`, which creates or recovers the owner.                               |
| `OWNER_INVITE_TOKEN` | Optional  | Requires a matching invite value on magic-link requests.                             |
| `AI_GATEWAY_TOKEN`   | Optional  | Authenticates AI Gateway calls.                                                      |

## Local overrides

`wrangler.dev.jsonc` already provides a development `SESSION_SECRET` and
`MCP_DEV_NO_AUTH=true`. To enable first-run setup locally, add `.dev.vars`:

```env
SESSION_SECRET=dev-only-insecure-session-secret
SETUP_TOKEN=dev-setup-token
```

`.dev.vars` is ignored by git. Never commit real secrets.

## Bindings

| Binding    | Resource                 | Use                                   |
| ---------- | ------------------------ | ------------------------------------- |
| `DB`       | D1                       | System of record                      |
| `MEDIA`    | R2                       | Images and audio                      |
| `OAUTH_KV` | KV                       | OAuth grants, refresh tokens, clients |
| `AI`       | Workers AI               | Clef fallback                         |
| `EMAIL`    | Cloudflare Email Service | Magic links                           |
| `ASSETS`   | Static assets            | The built SPA                         |

The daily cron trigger runs `runCleanup`, which prunes expired auth artifacts
and orphaned R2 media.

## Deployment notes

- `pnpm build` builds the SPA and the MCP widget.
- `pnpm build:all` also validates the Worker bundle.
- `pnpm deploy` builds and deploys with `wrangler.jsonc`.
- The root `wrangler.jsonc` intentionally omits D1/R2 ids so Appflare and the
  Deploy button can provision them.
- Apply migrations with
  `wrangler d1 migrations apply DB --remote --config wrangler.jsonc`.
