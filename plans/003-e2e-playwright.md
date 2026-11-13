# Plan 003 — Playwright e2e (scoping)

Status: implemented (v1), 2026-11-13. Deferred items are listed at the end.

Goal: a browser-level suite that proves the built SPA, the Worker, and the local
D1/R2 stack work together — runnable before every push and required on PRs to
`main`.

## Why e2e, concretely

The seams the current tests cannot see:

- `vitest` exercises routes with `FakeD1` (see `packages/api/src/routes/auth.test.ts`).
  Real migrations, real SQL, FTS, and the D1 query planner never run.
- Nothing loads the SPA today. Preact boot, `preact-iso` routing, `ASSETS`
  fallback, and deep links (`/decks/:id` opened cold) are untested.
- Base UI under Preact is "unofficial" (AGENTS.md, SPEC D12) and is currently
  smoke-tested by hand. A browser is the only honest check.
- Cookie session + CSRF double-submit is unit-tested with stubs, not through a
  real browser cookie jar.
- Contract drift between `@caly/shared` schemas and the webapp API client is
  invisible to both sides' tests.

Not the goal: scheduler math, grading rules, AI quality, load/perf, deployed
production, or cross-browser coverage. Those stay in unit tests or stay out.

## Decisions

1. **Run the production shape, not `pnpm dev`.** Build `packages/webapp`, then
   `wrangler dev` serves assets, `/api/v1/*`, `/media/*`, and `/mcp` on one
   origin. This is the only way to test `ASSETS`, `run_worker_first`, and
   `not_found_handling`. It also keeps the Agentation toolbar out of the DOM
   (`import.meta.env.DEV` is false in a build).
2. **Reuse `wrangler.dev.jsonc`; do not add a second config.** A copy drifts.
   The runner overrides on the CLI:
   `--port 8788 --persist-to <state> --var APP_URL:http://127.0.0.1:8788`.
   Port 8788 keeps a running `pnpm dev` on 8787 untouched.
3. **Auth via the dev magic-link API.** `ENVIRONMENT=development` already
   returns `devCode`/`devToken`, and the first magic-link request creates the
   owner. One setup call per run → `storageState` → every test starts signed in.
   Exactly one test drives the login form itself.
4. **Throwaway database per run.** Delete the persist dir, apply migrations,
   boot. No test-only reset endpoint and no shared state with `pnpm dev`.
5. **Single owner means data isolation, not user isolation.** `isEmailAllowed`
   admits one account, so tests get unique deck/card names and must not assert
   global counts, "latest deck", streak, or heatmap values. `workers: 1`.
6. **Chromium only in v1.** A mobile viewport project is a follow-up, not a
   prerequisite.
7. **Suite lives in `packages/e2e` as `@caly/e2e`.** It inherits the repo's
   lint/typecheck conventions and turbo wiring. Add it to `.changeset/config.json`
   `ignore` so test-only changes never bump the product version (it would
   otherwise join the `@caly/*` fixed group).
8. **Two tiers, one config.** `@smoke` runs pre-push and on every PR; the full
   suite runs on PRs only.
9. **No retries.** A flaky test gets quarantined and fixed; retries hide the
   regression that matters.

## Harness

```text
packages/e2e/
  playwright.config.ts      baseURL, projects, artifacts
  support/global-setup.ts   one dev magic-link → storageState
  support/api.ts            typed request helper (CSRF + @caly/shared types)
  support/fixtures.ts       test.extend: api, seedDeck, uniqueName
  scripts/serve.ts          build (optional) → reset state → migrate → wrangler dev
  tests/*.spec.ts
  .state/                   D1/R2 persist dir (gitignored)
```

`pnpm e2e` lifecycle:

1. `turbo run build --filter=@caly/webapp` (skip with `E2E_SKIP_BUILD=1`).
2. Delete `packages/e2e/.state`.
3. `wrangler d1 migrations apply DB --local --persist-to <state> --config wrangler.dev.jsonc`.
4. `wrangler dev --config wrangler.dev.jsonc --port 8788 --persist-to <state> --var APP_URL:http://127.0.0.1:8788`.
5. `playwright test`; Playwright waits on `/api/v1/health`.

Config essentials:

| Knob                              | Value                                            |
| --------------------------------- | ------------------------------------------------ |
| `baseURL`                         | `http://127.0.0.1:8788`                          |
| `workers` / `fullyParallel`       | `1` / `false`                                    |
| `retries`                         | `0`                                              |
| `trace`                           | `retain-on-failure`                              |
| `screenshot` / `video`            | `only-on-failure` / `off`                        |
| reporters                         | `list`, `html` (never auto-open), `github` in CI |
| `expect.timeout` / `test timeout` | `5s` / `30s`                                     |
| `webServer.timeout`               | `120s`, `reuseExistingServer: false`             |
| locale / timezone                 | `en-US` / `UTC`                                  |

Two guards worth writing on day one:

- Refuse to run when the resolved baseURL host is not `127.0.0.1`/`localhost`.
  The suite must never be pointed at a deployment.
- In smoke tests, fail on `pageerror` (uncaught exception) and collect
  `console.error` in the report.

## Test inventory

### P0 — smoke (`@smoke`), target < 90s

| #   | Journey                                       | Key assertion                                                       |
| --- | --------------------------------------------- | ------------------------------------------------------------------- |
| 1   | Cold boot `/`                                 | Dashboard renders, no page errors                                   |
| 2   | Anonymous `/decks/:id`                        | Redirects to `/login?next=…`; code sign-in returns to the deck      |
| 3   | Create deck from "New deck"                   | Deck appears in the library                                         |
| 4   | Add a basic card                              | Card row visible in the deck view                                   |
| 5   | Study 3 cards                                 | Reveal, grade Good ×3, "Session complete", stats show accuracy rows |
| 6   | Pause and resume                              | Exit mid-session, dashboard "Continue studying", progress preserved |
| 7   | Hard navigation to `/decks/:id`, `/study/:id` | 200 + renders (asset fallback, not Worker 404)                      |
| 8   | Unknown route                                 | SPA NotFound, not a Worker error page                               |

### P1 — core

- Deck rename, delete with confirmation, empty state.
- Bulk import: paste TSV → preview → import → rows/counters match.
- Card edit and delete; tag add, remove, and filter.
- Markdown safety: `<script>` in card front renders as text, never executes.
- Study modes beyond flashcards: multiple choice, typed, cloze, matching
  (auto-grading feeds the scheduler, so this is worth a real browser).
- Abandon session: it disappears from "Continue studying".
- Auth edges: wrong code error, sign-out, session list + revoke.
- Theme preference survives reload.

### P2 — later

- Collections: create, assign deck, reorder, rename, delete.
- Media: upload image, render via `/media/:id`, anonymous request rejected.
- API keys and a request-level MCP smoke (`initialize` + `tools/list`), using
  `MCP_DEV_NO_AUTH` or a created key.
- `@axe-core/playwright` scan on dashboard, deck, and study.
- Mobile viewport project for the smoke path.
- Arcade and achievements (canvas/confetti, higher flake cost).

### Explicitly out

AI/Clef output, AI Gateway, OAuth provider, browser extension, export
formats, 500-card limit paths, docs site, visual regression snapshots.

## Determinism rules

- Unique names per test: `E2E ${runId} ${testTitle}`; never assert a count, a
  date, "Latest deck", streak, or heatmap cell.
- No cross-file ordering and no `test.describe.serial` across files. Flows that
  need sequence live in one test.
- Web-first assertions only; no `waitForTimeout`.
- Block non-local network in the browser context. The app bundles fonts and has
  no third-party calls; a failure here is a real regression.
- `reducedMotion: 'reduce'`; avoid anything that depends on canvas state.
- Cleanup is unnecessary — the database is discarded after the run — but the
  seed fixture returns ids so tests can delete early when a flow needs a clean
  list.

## CI and the pre-push gate

New `e2e` job in `.github/workflows/ci.yml`, parallel with `verify`:

```text
pnpm install --frozen-lockfile
pnpm --filter @caly/e2e exec playwright install --with-deps chromium
pnpm e2e
```

- Cache `~/.cache/ms-playwright` keyed on the lockfile hash.
- `timeout-minutes: 20`; upload `.artifacts/report` and `.artifacts/test-results`
  on failure.
- `concurrency` keyed on ref, `cancel-in-progress: true`.
- The job name must be added to `main` branch protection. That is a manual
  GitHub setting and the actual gate; CI running is not the same as CI
  blocking a merge.

Pre-push, via the existing Husky setup:

```sh
# .husky/pre-push
[ "${SKIP_E2E:-0}" = "1" ] && exit 0
pnpm e2e:smoke
```

Costs and escape hatches to accept up front:

- ~60-90s added to each push after the browser is installed; `SKIP_E2E=1`
  bypasses it.
- `pnpm e2e:install` is required once per machine; the hook should tell the
  user that instead of failing cryptically.
- Optionally skip the hook when no `packages/{webapp,api,shared,ui,mcp}` file
  changed since `origin/main`. Nice-to-have, not v1.

Doc updates: `CONTRIBUTING.md` checks section, plus a short
`packages/e2e/README.md` for browser install, port collisions, stale `.state`,
and `--ui`/`--debug`/trace viewer.

## Risks and the spike checklist

Before building the suite, prove these in one throwaway spec:

1. `wrangler dev --persist-to` plus `d1 migrations apply --persist-to` share
   state, on Linux CI and Windows, and boot in under 20s.
2. Local assets: `GET /decks/deck_fake` returns `index.html`, and `/api/v1/health`
   returns `ok`.
3. `.dev.vars` interplay: confirm CLI `--var APP_URL` wins. The suite must not
   depend on a developer's `SESSION_SECRET`/`SETUP_TOKEN`.
4. AI stays off: `AI_GATEWAY_URL` is empty, so `isAiConfigured` is false and
   session start is deterministic. Assert a session starts with no AI call.
5. Rate limits share one IP bucket in local dev. One magic link per run fits
   (`10/600s`); a per-test login would not.
6. Base UI dialogs under Preact: focus trap, Escape, and `getByRole('dialog')`
   behave predictably in Playwright.
7. Built assets vs Vite dev: confirm no Agentation toolbar and no HMR websocket
   noise in the console.

Open questions:

- Should e2e ever run against a Cloudflare preview deploy? Recommendation: no
  for v1. It needs credentials, it is not hermetic, and it duplicates what CI
  already covers with the local runtime.
- Do we want `@cloudflare/vitest-pool-workers` for API×D1 integration tests?
  It would close the FakeD1 gap faster than a browser suite, but it is a second
  harness. Recommendation: separate later decision; e2e should not wait for it.
- Is a "study 20 cards" soak test worth the runtime? Recommendation: no. Three
  cards prove the loop; the scheduler is covered by unit tests.

## Rollout

1. **Spike (0.5-1 day).** Package skeleton, serve script, one test that boots and
   logs in. Resolve the checklist above.
2. **Smoke (1-2 days).** Eight `@smoke` tests, fixtures, CI job, pre-push hook,
   docs. This is the point where the gate is real.
3. **Core (2-3 days).** P1 tests, quarantine policy, mobile viewport and axe if
   they stay cheap.
4. **Stabilise.** Two weeks of watching CI; every flake gets a cause, not a
   retry.

Estimated steady-state cost: ~5 min CI per PR, ~90s per push locally.

## What shipped (v1)

- `packages/e2e` (`@caly/e2e`, ignored by changesets) with 19 tests: eight
  `@smoke` plus deck, card, study, and settings coverage.
- `scripts/serve.mjs` builds, resets, migrates, and boots the Worker on 8788.
- The `e2e` CI job, caching Chromium and uploading reports on failure.
- The Husky `pre-push` hook runs `pnpm e2e:smoke`; `SKIP_E2E=1` bypasses it.
- Plumbing: `.changeset/config.json` ignores the package, `knip.jsonc` knows
  its entry points, and the root ESLint config ignores run artifacts and gives
  the Node script its globals.

Deltas from the scoping pass:

- Deck delete has no confirmation dialog, so that test asserts the redirect and
  disappearance instead.
- The profile menu trigger renders as a `group`, not a button; the sign-out test
  uses the Settings page button and creates its own session so the shared
  storage state survives.
- Only two auto-graded modes shipped (`multiple_choice` in the suite); typed,
  cloze, and matching remain P2.

Still deferred: media upload/R2, collections reorder and rename, API keys and
MCP request-level tests, axe scans, a mobile viewport project, arcade and
achievements.
