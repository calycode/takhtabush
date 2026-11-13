# @caly/e2e

Browser tests for the built app running on one Worker. See
[`plans/003-e2e-playwright.md`](../../plans/003-e2e-playwright.md) for the
design decisions.

## What it runs

`pnpm e2e` does all of this, in order:

1. Builds `@caly/webapp` (skip with `E2E_SKIP_BUILD=1`).
2. Deletes `packages/e2e/.state` and applies the real migrations to a fresh
   local D1.
3. Starts `wrangler dev` on `127.0.0.1:8788` using `wrangler.dev.jsonc`.
4. Signs in once through the development magic-link API and reuses that
   `storageState`.
5. Runs Playwright in Chromium.

The Vite dev server is not used on purpose: the suite must exercise the
Worker's asset serving, the SPA deep-link fallback, and the production build
(which omits the development-only Agentation toolbar).

## Commands

```bash
pnpm e2e:install  # once per machine
pnpm e2e          # full suite
pnpm e2e:smoke    # only @smoke, what pre-push runs
pnpm e2e:ui       # Playwright UI mode
```

Useful escape hatches:

- `SKIP_E2E=1 git push` skips the pre-push hook.
- `E2E_SKIP_BUILD=1 pnpm e2e` reuses the last `packages/webapp/dist/client`.
- `E2E_PORT=8790 pnpm e2e` moves the Worker if 8788 is taken.
- `pnpm --filter @caly/e2e exec playwright show-trace <zip>` opens a trace.

## Rules

- Only localhost. The config refuses any other base URL; never point this at a
  deployment.
- One owner, one database. Tests are isolated by unique names from
  `uniqueName()`, not by user or database.
- Never assert global counts, "Latest deck", streak, or heatmap values. Another
  test's data is in the same database.
- No `waitForTimeout`. Use web-first assertions; `expect` retries for 5s.
- Requests leaving localhost are blocked by a fixture. The app bundles everything
  it needs; an external call is a regression.
- No retries. If a test is flaky, fix the cause or quarantine it with a comment.
- Seed data through `api` when the data is not the thing under test. Click
  through the UI only for the interaction under test.
- A test that mutates the shared session (sign-out, revoke) must create its own
  session, like `tests/auth.spec.ts` does.

## Adding a test

1. Put it in the closest existing spec file.
2. Prefer role-based locators (`getByRole`, `getByLabel`). Base UI menus render
   as buttons; the profile trigger in the header is a group, not a button.
3. Wrap a multi-phase journey in `test.step(...)`; UI mode and the trace viewer
   show the steps with their own timings.
4. Give raw-value assertions a message. `expect(response?.status(), 'the Worker
must serve the SPA shell for /decks/:id, not a 404').toBe(200)` reads much
   better in the UI mode error panel than `Expected: 200`.
5. Mark the few paths that must pass before every push with `@smoke`.
6. Keep the smoke tier under 90 seconds.

## Troubleshooting

- **`127.0.0.1:8788 is already in use`**: the runner reclaims a stale
  `wrangler`/`workerd` on that port automatically. If something else holds it,
  stop that process or set `E2E_PORT`.
- **`playwright: command not found` / browser missing**: run
  `pnpm e2e:install`.
- **Stale data or a half-applied migration**: `pnpm e2e` resets `.state` on
  every run, so delete `packages/e2e/.state` if a run was interrupted.
- **`.dev.vars` surprises**: Wrangler also loads a developer's `.dev.vars`.
  The tests never need `SESSION_SECRET` or `SETUP_TOKEN`, but an
  `OWNER_EMAIL`/`ALLOWED_EMAILS` override in `.dev.vars` will block the test
  account. Keep those out of `.dev.vars` or remove them locally.
