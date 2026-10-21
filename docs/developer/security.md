# Security

Takhtabush is self-hosted authentication and data software. This page explains
the model and the operator’s responsibilities. To report a vulnerability, use
the private advisory link in [`SECURITY.md`](../../SECURITY.md), not a public issue.

## Authentication

- Sign-in is an email magic link. The token is stored only as a hash and expires
  after 15 minutes.
- A successful sign-in creates an HTTP-only `sid` session cookie with
  `SameSite=Lax` and `Secure` when the request is HTTPS.
- Browser mutations use a double-submit CSRF token: a readable `csrf` cookie
  plus the `x-csrf-token` header. Bearer requests are exempt.
- Sessions are first-class: list them, revoke one, or revoke all from settings.
- Auth routes are rate limited in D1 with a `Retry-After` response.

## Single tenancy

The default is one tenant. The first account to sign in becomes the owner.

| Setting              | Effect                                                         |
| -------------------- | -------------------------------------------------------------- |
| `OWNER_EMAIL`        | Pins the only allowed address                                  |
| `ALLOWED_EMAILS`     | Complete allowlist for new accounts when set                   |
| neither              | The first user claims ownership; later addresses are blocked   |
| `OWNER_INVITE_TOKEN` | Requires a matching `invite` value on every magic-link request |
| `SETUP_TOKEN`        | Enables `/setup` to create or recover the owner without email  |

Existing accounts keep working unless `OWNER_EMAIL` pins a different owner.
The gate is applied when a magic link is requested and again when it is
verified.

This release is not a multi-tenant product. Content is owned by a user, and
study progress is stored per `(user_id, card_id)`. A future shared workspace
must add an explicit workspace scope to content; do not treat the current
`owner_id` convention as tenant isolation.

## Secrets

Set these as Worker secrets, never in a committed file:

| Secret               | Required            | Purpose                                                                                  |
| -------------------- | ------------------- | ---------------------------------------------------------------------------------------- |
| `SESSION_SECRET`     | Yes                 | Hashes session and magic-link tokens; signs OAuth consent cookies. Use 32+ random bytes. |
| `SETUP_TOKEN`        | For first-run setup | Creates or recovers the owner                                                            |
| `OWNER_INVITE_TOKEN` | Optional            | Extra invite gate on magic-link requests                                                 |
| `AI_GATEWAY_TOKEN`   | Optional            | Clef through AI Gateway                                                                  |

`SESSION_SECRET` must be stable across deploys or every session is invalidated.
Rotate `SETUP_TOKEN` after setup if you do not need recovery, or keep it strong.

## API keys and OAuth

- API keys are shown once and stored as a hash. Each key has a name, scopes, an
  optional expiry, and a last-used timestamp.
- Keys can call only tools covered by their scopes. `tools/list` is filtered to
  the same grant.
- OAuth grants, refresh tokens, and registered clients live in `OAUTH_KV`.
- OAuth consent uses `__Host-` cookies; test the full flow over HTTPS.
- OAuth and API keys resolve to the same user and the same MCP scope model.

## Media

- R2 object keys are owner-prefixed.
- Uploads start with a metadata row; the object is written only after the
  owner is checked.
- Reads go through `/media/:id`, which checks ownership before streaming.
- The Worker does not expose R2 directly.

## MCP

- The MCP package depends on `@caly/shared` and the injected `McpServices`
  interface. It never imports D1 or R2.
- Mutating tools write to `mcp_audit_events`.
- There is no code execution tool in v0.1.
- `MCP_DEV_NO_AUTH` is ignored unless `ENVIRONMENT=development`.

## Hardening checklist

- [ ] Set a unique `SESSION_SECRET` with 32+ random bytes.
- [ ] Set `OWNER_EMAIL` or a complete `ALLOWED_EMAILS` list.
- [ ] Remove or rotate `SETUP_TOKEN` after the owner is created.
- [ ] Use HTTPS and connect MCP clients to the canonical origin.
- [ ] Restrict Cloudflare dashboard and API-token access.
- [ ] Keep D1 and R2 permissions scoped to this Worker.
- [ ] Review active sessions and API keys periodically.
- [ ] Watch the daily cleanup job for expired auth artifacts and orphaned media.
- [ ] Keep dependencies current; Dependabot opens weekly PRs.

## Out of scope

Misconfiguration of your own deployment, volumetric denial of service, social
engineering, and automated scanner reports without a demonstrated impact are
out of scope. See [`SECURITY.md`](../../SECURITY.md) for the full policy.
