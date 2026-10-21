# Takhtabush — Unified Worker Specification

**Revision:** 8 · **Date:** 2026-10-20 · **Status:** Phases 1–3 implemented; single tenancy + first-run setup; Phase 4 deferred; Phase 6 host validation pending
**Deployment model:** Single Cloudflare Worker, single tenant by default
**Stack:** Preact + Vite, shadcn/ui (Base UI), Tailwind CSS v4, Hono, Cloudflare D1, R2, Email Service, AI Gateway / Workers AI, MCP

> **Revision 9** (2026-10-21) adds OAuth 2.1 for ChatGPT on `/mcp`: `@cloudflare/workers-oauth-provider` protects OAuth bearers while API keys and sessions bypass it, with CIMD/DCR, PKCE, refresh tokens, and a consent page that reuses the existing magic-link session. `/mcp/oauth` is a path-descendant alias. **Revision 8** (2026-10-20) enforces single tenancy and adds first-run setup. The first user is the owner; later addresses need to be listed in `ALLOWED_EMAILS`, and `OWNER_EMAIL` pins the owner from the start. `SETUP_TOKEN` enables `GET /api/v1/auth/status` plus `POST /api/v1/auth/setup`, which creates the owner before email is configured and recovers owner access later. A partial unique index allows at most one owner row. The production/Appflare config is the root `wrangler.jsonc`; local development uses `wrangler.dev.jsonc`. **Revision 7** (2026-10-14) lets card **definitions** be authored and rendered as Markdown. The `back` field of a `term_definition` (and the answer of `typed`/`image_prompt`) is stored as raw Markdown — the only stored form — and is edited with a tiny inline WYSIWYG editor that parses the source into an ephemeral IR (never persisted) and serializes edits back to raw Markdown. Every read surface renders that Markdown: the study card (webapp and MCP Apps widget via the shared `StudyCardShell`), the deck card table, and the card-details dialog. Typed grading and compact previews flatten Markdown to plain text. **Revision 6** (2026-10-14) adds an optional MCP Apps-compatible study-session UI for chat hosts such as ChatGPT. It uses a decoupled data-tool/render-tool flow: `start_study_session` creates and returns session data, while `render_study_session` returns an MCP Apps UI resource. The widget renders a server-authoritative session snapshot and records reviews through `record_review`. **Revision 5** (2026-10-14) makes card deletion consistent: `DELETE /cards/:id` is a soft delete with in-place confirmation and undo (`POST /cards/:id/restore`), every statistic excludes deleted cards, and the cleanup job hard-deletes cards (with their events, revisions, and state) 30 days after deletion. It also polishes study interaction: multiple-choice options render as a large tappable grid with numbered key hints, prompt and answer share equal emphasis, and the typed input is focused for each new card. The import parser gained a configurable column delimiter and tags separator plus a live preview table. **Revision 4** adds optional API key expiration, SQL keyset pagination for `search_cards`, removal of the dead `learning_state.suspended` column, an explicit pause-vs-abandon choice on session exit, import file uploads with shared client-side validation plus an export menu, and cursor pagination for the deck and card lists. **Revision 3** added the scheduled cleanup job, suspend/resume, performance-based grading (all four responses), selectable goals, and the full session lifecycle. **Revision 2** folded in Cloudflare Email Service magic links, D1-backed auth rate limiting, opaque **API-key** auth for MCP (instead of OAuth), session management, per-mode study screens with **two matching variants**, R2 media upload, and shared grading helpers. New items are tagged **[R2]** / **[R3]** / **[R4]** / **[R5]** / **[R6]** / **[R7]**; see §20 for the changelog.

## 1. Product summary

Takhtabush is a self-hosted, lightweight Quizlet-like learning app deployed as one Cloudflare Worker. A user creates, imports, organizes, studies, and analyzes flashcard decks.

Content creation is separate from learning intelligence:

- Users author flashcards manually or import them.
- Clef, through AI Gateway, selects, sequences, prioritizes, and adapts existing cards into dynamic learning journeys.
- Clef does not generate flashcard content.
- A future optional AI authoring feature may use text models through AI Gateway; generated cards remain drafts until approved.
- An MCP layer lets coding agents read learning data, create/import decks, and start sessions.
- **[R6] An optional MCP Apps UI lets a compatible LLM chat request and render an actual flashcard study session inline, using the same server-authoritative session and review-event model as the Preact web app.**

### V1 principles

- Single tenant by default; one deployment belongs to one user or small trusted group.
- One Worker serves the SPA, API, media endpoints, and MCP endpoint.
- D1 is the system of record. R2 stores binary media only.
- Review events are append-only; learning state is derived and rebuildable.
- AI features are optional, bounded, cached, and degrade gracefully.
- The scheduler is deterministic, versioned, and independently testable.
- No realtime collaboration, multi-tenancy, billing, or marketplace in V1.

## 2. Architecture

### 2.1 Runtime topology

```text
Browser / MCP client / ChatGPT MCP App
        |
        v
Cloudflare Worker
├── Static assets: Preact SPA
├── /api/v1/*: Hono REST API
├── /mcp: MCP Streamable HTTP endpoint (API keys or OAuth)
├── /mcp/oauth: OAuth alias under the canonical /mcp resource
├── /oauth/*: authorization, consent, token, and registration endpoints
├── /.well-known/*: OAuth protected-resource/authorization-server metadata
├── /mcp-apps/study-session/v1.html: MCP Apps UI resource
├── /media/*: authenticated R2 read proxy
└── Bindings: D1, R2, KV (OAUTH_KV), EMAIL, AI, ASSETS
```

A single Worker is intentional: it reduces deployment complexity, avoids cross-Worker routing, and keeps local development simple.

### 2.2 Repository layout

```text
takhtabush/
├── package.json / pnpm-workspace.yaml / turbo.json
├── wrangler.jsonc                 # unified Worker config (root)
├── vitest.config.ts / eslint.config.js / tsconfig.base.json / knip.jsonc
├── .env.example / .dev.vars.example
├── migrations/
│   ├── 0001_init.sql              # core tables
│   ├── 0002_indexes.sql
│   ├── 0003_rate_limits.sql       # [R2]
│   ├── 0004_api_keys.sql          # [R2]
│   ├── 0005_drop_learning_state_suspended.sql  # [R4]
│   └── 0006_api_keys_expires_at.sql            # [R4]
├── packages/
│   ├── webapp/  api/  mcp/  study-widget/  ui/  shared/  worker-kit/
├── docs/  plans/
└── AGENTS.md / CONTEXT.md / README.md / SPEC.md
```

### 2.3 Package responsibilities

| Package              | Responsibility                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------- |
| `@caly/webapp`       | Preact SPA, routes, feature components, API client                                          |
| `@caly/api`          | Hono routes, services, repositories, D1/R2/EMAIL/AI integrations; unified Worker entrypoint |
| `@caly/mcp`          | MCP tools, API-key scopes, compact projections, audit events, MCP Apps UI tool              |
| `@caly/ui`           | Generated shadcn/Base UI primitives, shared study components, and shared UI utilities       |
| `@caly/shared`       | Zod schemas, domain types, API contracts, scheduler + grading logic                         |
| `@caly/worker-kit`   | CORS, error envelope, request context, id helpers                                           |
| `@caly/study-widget` | **[R6]** Small standalone Preact bundle for the MCP Apps study-session widget               |

Dependency rules:

- `webapp` may import `ui`, `shared`, and `worker-kit`.
- `study-widget` may import `ui`, `shared`, and `worker-kit`; it must not import `webapp`.
- `api` may import `shared`, `worker-kit`, and `mcp` (to mount `/mcp`).
- `mcp` may import `shared` and call injected domain services (`McpServices`); it must not import `api` or touch D1/R2.
- `ui` and `shared` must not import application packages.
- Neither `api` nor `mcp` may import `webapp`.

## 3. Authentication and tenancy

### 3.1 Tenancy model

- One deployment has one primary owner; all data stays within the deployment.
- `owner_id` is retained on user-owned resources for a future multi-tenant migration.
- No organization, workspace, billing, or per-customer isolation in V1.

### 3.2 Auth approach

Session-based authentication with secure HTTP-only cookies.

V1 supports:

- Email magic-link login.
- Optional single-user bootstrap mode using an owner invite token.
- Logout and session revocation (list/revoke all sessions).
- CSRF protection (double-submit cookie) for cookie-authenticated browser mutations.
- **[R2] Login delivered through the Cloudflare Email Service `EMAIL` binding** (`send_email`). `wrangler dev` simulates delivery; deployed Workers send from `EMAIL_FROM` (an onboarded domain).
- **[R2] Environment-gated dev tokens**: when `ENVIRONMENT !== "production"` the API also returns the raw magic-link token so sign-in works without a mailbox; in production the raw token is never returned and a successful send is required (`502` otherwise).
- **[R2] Optional `OWNER_INVITE_TOKEN`** gate: when set, every magic-link request must carry a matching `invite` value.
- **[R8] Single tenancy**: the first user becomes `is_owner`; later addresses must be listed in `ALLOWED_EMAILS`. `OWNER_EMAIL` pins the owner from the start. A partial unique index (`0007_single_owner.sql`) allows at most one owner row.
- **[R8] First-run setup and recovery**: `SETUP_TOKEN` enables `GET /api/v1/auth/status` and `POST /api/v1/auth/setup`. Setup creates the owner while no users exist and signs the existing owner back in later, so a catalog install works before its email sender domain is configured. The token is rate limited and optional.
- **[R2] Auth rate limiting** (D1 fixed window): magic-link per IP (10 / 10 min) and per email (5 / 15 min); verify per IP (20 / 10 min). Exceeded requests return `429` with `Retry-After`.

Deferred: password auth, passkeys/WebAuthn, OAuth social login, organizations/RBAC.

### 3.3 Sessions

```text
sessions
  id TEXT PRIMARY KEY
  user_id TEXT NOT NULL
  token_hash TEXT NOT NULL UNIQUE
  user_agent TEXT
  ip_hash TEXT
  created_at TEXT NOT NULL
  expires_at TEXT NOT NULL
  revoked_at TEXT
```

Rules:

- Store only a hashed session token; never store the raw token.
- Cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` when the app origin is HTTPS.
- Rotate the session id on login; expire inactive sessions after 30 days.
- Invalidate sessions on owner revocation or bulk sign-out.
- **[R2] Management**: `GET /api/v1/sessions` lists active sessions (with a `current` marker); `DELETE /api/v1/sessions/:id` revokes one (clearing cookies when it is current); `DELETE /api/v1/sessions` revokes all others.

### 3.4 API authentication

| Client           | Mechanism                                                                               |
| ---------------- | --------------------------------------------------------------------------------------- |
| Browser SPA      | HTTP-only session cookie + `x-csrf-token` header                                        |
| MCP client       | **[R2]** API key (`Authorization: Bearer <key>` or `x-api-key: <key>`) on `/mcp`        |
| ChatGPT          | **[R9]** OAuth 2.1 on `/mcp` (CIMD/DCR, PKCE, refresh tokens); `/mcp/oauth` is an alias |
| MCP Apps widget  | **[R6]** Same MCP API key/OAuth authorization; calls MCP tools through the host bridge  |
| Local automation | API key (same as MCP)                                                                   |

All API routes except `/api/v1/health` and the auth endpoints require authentication, and unknown `/api` paths never fall through to the SPA.

**[R2] API keys** (`api_keys` table): created from the `/mcp` screen (`POST /api/v1/api-keys`), shown once, stored only as a hash, prefixed `fck_`, and scoped to a subset of the MCP scopes. API keys authenticate **only** the `/mcp` endpoint; the browser session (cookie) manages keys. Optional `x-mcp-scopes` narrows a key's scopes per request. **[R4]** Keys may optionally expire (`expiresInDays`; `expires_at` NULL means never) and can be revoked; expired and revoked keys are rejected. Key rotation and per-key rate limits are intentionally not implemented.

**[R9] ChatGPT OAuth.** ChatGPT's web connector cannot send a static API-key header, so `/mcp` is both the API-key endpoint and the canonical OAuth resource, protected by `@cloudflare/workers-oauth-provider`. API keys and session cookies bypass the provider into the existing Hono route; OAuth bearers are validated by the provider. `/mcp/oauth` is a path descendant and works as an alias. The provider publishes RFC 9728/RFC 8414 metadata at both the flat and path-specific well-known URLs, supports CIMD (preferred) and DCR, issues its own access/refresh tokens, and stores grants in `OAUTH_KV`. `/oauth/authorize` reuses the normal magic-link session and shows a consent page.

## 4. Data model

### 4.1 D1 schema

Core tables live in `migrations/0001_init.sql`: `users`, `decks`, `cards`, `card_revisions`, `folders`, `media_objects`, `study_sessions`, `review_events`, `learning_state`, `ai_evaluations`, `mcp_audit_events`, plus the auth tables `sessions` and `magic_link_tokens`.

**[R2] Added tables** (`0003_rate_limits.sql`, `0004_api_keys.sql`):

```sql
CREATE TABLE rate_limits (
  bucket TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
);

CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  scopes_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at TEXT
);
```

**[R2] Change:** `ai_evaluations` gains a `status` column (`succeeded` | `failed` | `skipped`) so failures are recorded, not just successful results. All timestamps are ISO-8601 TEXT; identifiers are prefixed (`deck_…`, `card_…`, `usr_…`).

**[R6] No new core tables are required.** The MCP Apps widget operates on the existing `study_sessions`, `cards`, and append-only `review_events` data. It must not introduce a separate widget-side source of truth.

### 4.2 Indexes

`0002_indexes.sql` (core):

```sql
CREATE INDEX idx_decks_owner ON decks(owner_id, deleted_at, updated_at DESC);
CREATE INDEX idx_cards_deck ON cards(deck_id, deleted_at, updated_at DESC);
CREATE INDEX idx_cards_owner ON cards(owner_id, deleted_at);
CREATE INDEX idx_reviews_user_card ON review_events(user_id, card_id, reviewed_at DESC);
CREATE INDEX idx_reviews_session ON review_events(session_id, reviewed_at);
CREATE INDEX idx_learning_due ON learning_state(user_id, due_at, suspended);
CREATE INDEX idx_media_owner ON media_objects(owner_id, status, created_at DESC);
CREATE INDEX idx_ai_subject ON ai_evaluations(subject_type, subject_id, created_at DESC);
```

**[R2] Additional** indexes: `sessions(user_id, expires_at)`, `magic_link_tokens(email, expires_at)`, `decks(owner_id, folder_id, deleted_at)`, `study_sessions(user_id, deck_id, status)`, `mcp_audit_events(user_id, created_at DESC)`, `rate_limits(window_start)`, `api_keys(user_id, revoked_at)`, `api_keys(key_hash)`.

### 4.3 Card types

| Type              | Required fields                           | Behavior                            |
| ----------------- | ----------------------------------------- | ----------------------------------- |
| `term_definition` | `front`, `back`                           | Reversible flashcard                |
| `cloze`           | `cloze_text` (tokens in `{{…}}`)          | Hidden token(s) in a sentence       |
| `multiple_choice` | `front`, `choices_json`, `correct_choice` | One correct option                  |
| `typed`           | `front`, `back`                           | Free-text answer with normalization |
| `image_prompt`    | `image_media_id`, `back`                  | Image prompt with a text answer     |

**[R2] Authoring**: all five types are creatable/editable in the webapp (`CardForm`); `image_prompt` requires an uploaded image. Any card may also carry optional image/audio media. Tags are a JSON array; authored as a comma-separated field with display chips and filtering.

## 5. Storage and media

### 5.1 R2 layout

```text
media/{userId}/{mediaId}/{filename}
```

### 5.2 Upload flow

**[R2]** (implemented end-to-end):

1. `POST /api/v1/media/intent` validates MIME type and intended size; a `media_objects` row is created (`pending`).
2. The response returns a **same-origin** `uploadUrl` (`/api/v1/media/{id}/content`, `PUT`) and the media object.
3. `PUT /api/v1/media/{id}/content` stores the object in R2 and marks the row `ready`.
4. `POST /api/v1/media/{id}/complete` verifies the object exists and finalizes size/checksum (idempotent).
5. Cards reference `media_objects.id`, never raw R2 keys.

`GET /media/intent` is accepted as an alias for clients that follow the original spec verbatim.

### 5.3 Limits

| Asset | Maximum size | Allowed types        |
| ----- | ------------ | -------------------- |
| Image | 5 MB         | PNG, JPEG, WebP, GIF |
| Audio | 10 MB        | WebM, MP3, M4A, WAV  |

### 5.4 Access

- Media is private by default.
- `GET /media/:mediaId` (Worker route) checks ownership and streams the R2 object; the SPA uses it directly for `<img>`/`<audio>`.
- `GET /api/v1/media/:id` returns metadata; `GET /api/v1/media/:id/content` streams the object.
- **[R3] Cleanup job:** a daily cron (`scheduled` handler, `triggers.crons` in `wrangler.jsonc`) prunes expired sessions and magic links, old rate-limit windows, revoked API keys, and old audit events, and deletes orphaned R2 media (unreferenced + older than 7 days, batch-capped). **[R5]** It also hard-deletes cards soft-deleted more than 30 days ago, together with their review events, revisions, and learning state — deletion is therefore soft in the UI (with undo) and permanent only once cleanup runs.

## 6. API specification

### 6.1 Conventions

Base URL `/api/v1`. Success envelope `{ "data": {}, "meta": {} }`; error envelope `{ "error": { "code", "message", "details" } }`. List endpoints use cursor pagination (`{ data, meta: { nextCursor, hasMore } }`) with a default page size of 20 and a maximum of 50. **[R2]** `429` responses include `Retry-After`.

### 6.2 Endpoints

| Method | Path                           | Purpose                                                  |
| ------ | ------------------------------ | -------------------------------------------------------- |
| GET    | `/health`                      | Liveness/readiness (DB check)                            |
| POST   | `/auth/magic-link`             | Request login link (rate limited)                        |
| POST   | `/auth/verify`                 | Exchange magic-link token for session                    |
| POST   | `/auth/logout`                 | Revoke current session                                   |
| GET    | `/me`                          | Current user and preferences                             |
| PATCH  | `/me`                          | Update display name **[R2]**                             |
| GET    | `/sessions`                    | **[R2]** List active sessions                            |
| DELETE | `/sessions/:id`                | **[R2]** Revoke one session                              |
| DELETE | `/sessions`                    | **[R2]** Revoke all other sessions                       |
| GET    | `/api-keys`                    | **[R2]** List MCP API keys                               |
| POST   | `/api-keys`                    | **[R2]** Create an API key (secret shown once)           |
| DELETE | `/api-keys/:id`                | **[R2]** Revoke an API key                               |
| GET    | `/decks`                       | List decks                                               |
| POST   | `/decks`                       | Create deck                                              |
| GET    | `/decks/:id`                   | Deck detail                                              |
| PATCH  | `/decks/:id`                   | Update deck                                              |
| DELETE | `/decks/:id`                   | Soft-delete deck                                         |
| GET    | `/decks/:id/cards`             | List cards                                               |
| POST   | `/decks/:id/cards`             | Create card                                              |
| GET    | `/cards/:id`                   | Card detail                                              |
| PATCH  | `/cards/:id`                   | Update card                                              |
| DELETE | `/cards/:id`                   | Soft-delete card (undoable; purged by cleanup)           |
| POST   | `/cards/:id/suspend`           | **[R3]** Suspend a card                                  |
| POST   | `/cards/:id/resume`            | **[R3]** Resume a card                                   |
| POST   | `/cards/:id/restore`           | **[R5]** Undo a soft-deleted card                        |
| POST   | `/decks/:id/import`            | Import CSV/TSV/JSON                                      |
| GET    | `/decks/:id/export`            | Export deck (csv/tsv/json)                               |
| POST   | `/media/intent`                | Create media upload intent (GET alias)                   |
| PUT    | `/media/:id/content`           | **[R2]** Upload object bytes to R2                       |
| POST   | `/media/:id/complete`          | Complete upload                                          |
| GET    | `/media/:id`                   | Media metadata                                           |
| GET    | `/media/:id/content`           | **[R2]** Stream media object                             |
| GET    | `/study/sessions`              | **[R3]** List sessions (status filter)                   |
| POST   | `/study/sessions`              | Start study session                                      |
| GET    | `/study/sessions/:id`          | Session detail (+ `reviewedCardIds` for resume) **[R3]** |
| POST   | `/study/sessions/:id/reviews`  | Append review event                                      |
| POST   | `/study/sessions/:id/complete` | Complete session                                         |
| POST   | `/study/sessions/:id/abandon`  | **[R3]** Abandon an active session                       |
| GET    | `/stats/decks/:id`             | Deck learning statistics                                 |
| GET    | `/study/recommendation`        | Clef-informed study plan (scheduler fallback)            |
| POST   | `/ai/evaluations`              | Request bounded Clef evaluation                          |

### 6.3 Validation

All external input is validated with Zod schemas from `@caly/shared`. Card creation uses type-aware refinement (e.g. `cloze` requires `clozeText`, `multiple_choice` requires ≥2 choices and an in-range `correctChoice`, `image_prompt` requires `imageMediaId`).

### 6.4 Import and export **[R4]**

- Import accepts file uploads (`.csv`, `.tsv`, `.json`, ≤1 MB) as well as pasted text; the shared parser validates structure before submitting (row + issue preview) and the API rejects unparseable content with `422`.
- **[R5]** Parsing is configurable via `delimiter` (CSV column delimiter: comma, semicolon, tab, pipe, or `auto` to infer it from the content) and `tagSeparator` (comma, semicolon, pipe, space, or `none` to keep the tags field whole). The import screen renders a live preview table (front, back, tags) plus any row errors before the user commits, so ambiguous content such as `;` inside tags or a `;`-delimited file can be corrected without editing the source.
- Export is available from the deck view as a `csv`/`tsv`/`json` download.

## 7. Learning journey

### 7.1 Study modes

| Mode              | Description                                                                        |
| ----------------- | ---------------------------------------------------------------------------------- |
| `flashcards`      | Self-graded reveal card                                                            |
| `multiple_choice` | Choose the correct option                                                          |
| `typed`           | Type the answer; normalized comparison                                             |
| `matching`        | **[R2]** Two variants: `pairs` (two-column association) and `choice` (option pick) |
| `cloze`           | Fill missing text                                                                  |
| `mixed`           | Per-card dispatch based on the card type                                           |

**[R2] Matching variants.** `pairs` is a two-column exercise over batches of up to four cards (pick a term, then its match; each correct pair records a `good` review and the batch advances). `choice` is an option pick, generating distractors from the queue when a card has no explicit choices. Both are selectable in-session; each trains a different aspect of recall.

**[R2] Grading helpers** (`@caly/shared`): `normalizeAnswer` (case/accents/punctuation/whitespace), `checkAnswer`, `extractClozeTokens`, `maskCloze`, `checkCloze`. **[R3]** `gradeFromPerformance({ correct, durationMs, attempts })` maps performance to a response so **all four** appear in auto-graded modes: incorrect -> `again`, retried or slow correct -> `hard`, fast correct -> `easy`, otherwise `good`. Matching pairs tracks per-card attempts and elapsed time. **[R6]** `interactionFor` (how a card is presented for a mode) also lives in `@caly/shared` so the web app and the widget derive it identically.

### 7.2 Scheduler

A versioned SM-2-inspired scheduler in `@caly/shared`. Responses: `again`, `hard`, `good`, `easy`. It updates due date, interval, ease, repetitions, lapses, and scheduler-state JSON. `review_events` are immutable; `learning_state` is derived and rebuildable. Version is stored per learning-state row. Daily defaults: 20 new, 200 reviews. Suspended cards are excluded from automatic sessions and from due/new/weak queues. **[R3]** `POST /cards/:id/suspend` and `/resume` toggle `cards.status`; the deck table shows a suspended badge with a toggle. **[R4]** Suspension is `cards.status` only — the vestigial `learning_state.suspended` column was removed (migration 0005; it was never written, so its filters were no-ops).

### 7.3 Dynamic journey creation

A server-generated plan (not a random order). Inputs: deck/selected set, available time, goal (`learn`, `review`, `cram`, `retain`, `diagnose`), current learning state, recent history, card metadata/tags. Output: `{ sessionId, mode, strategy, estimatedMinutes, cardIds, reasons, fallbackUsed }`.

**[R3]** Goals are selectable in the study launcher (mode, goal, minutes, and the matching layout) and drive the journey strategy (e.g. `learn` -> `mixed`, `review` -> `consolidate`).

### 7.4 Clef role

Clef receives a compact state and typed questions and returns probabilities over allowed options (decisions, not generation): session strategy (`choice`), next mode (`choice`), include card (`noul`), card priority/difficulty (`score`), duplicate likelihood (`noul`), subject (`choice`), clarity (`score`). Called through AI Gateway; on failure, timeout, or low confidence the API falls back to the deterministic scheduler.

## 8. AI Gateway and Clef

### 8.1 Service boundary

`packages/api/src/services/ai/`: `gateway-client.ts`, `clef.ts`, `schemas.ts`, `cache.ts`, `evaluation-service.ts`. Only the API calls AI Gateway / Workers AI; the browser never receives credentials; MCP calls `get_study_plan` and cannot invoke Clef directly. Every evaluation records model, input hash, schema, result, status, confidence, and gateway request id. Deterministic evaluations are cached by input hash + schema version.

### 8.2 Clef evaluation contract

```ts
export const cardEvaluationSchema = z.object({
   clarity: z.number().min(1).max(5),
   difficulty: z.number().min(1).max(5),
   duplicateLikelihood: z.number().min(0).max(1),
   subject: z.enum(['language', 'biology', 'history', 'programming', 'mathematics', 'other']),
});
```

### 8.3 Failure behavior

| Failure          | Behavior                                 |
| ---------------- | ---------------------------------------- |
| Gateway timeout  | Return fallback scheduler plan           |
| Clef unavailable | Mark evaluation `failed`; continue study |
| Low confidence   | Use deterministic thresholds             |
| Invalid output   | Reject evaluation and log diagnostic     |
| Rate limit       | Queue or defer evaluation                |

## 9. MCP layer

### 9.1 Endpoint

`/mcp`. A remote, stateless MCP server over Streamable HTTP. **[R2]** Bearer **API key** auth protects the endpoint and scopes authorize individual tools; clients need only a URL plus an auth header. Local development may set `MCP_DEV_NO_AUTH=true` (with `ENVIRONMENT=development`) to use the owner account without a credential; a supplied API key is still validated, and the flag is ignored in production.

**[R9]** `/mcp` exposes the same tools through both API-key and OAuth 2.1 auth. The Worker uses `@cloudflare/workers-oauth-provider` for discovery, token issuance, CIMD/DCR, and audience validation; `/mcp/oauth` is a path descendant that also works. `/oauth/authorize` is a server-rendered consent page backed by the existing session cookie. API-key and OAuth tokens resolve to the same user and MCP scopes, and both paths write the same audit records.

### 9.2 Design decision

Curated workflow tools only. Do not expose every database operation. Full search-and-execute Code Mode is deferred until the API surface grows.

### 9.3 Authorization scopes

| Scope          | Permission                                        |
| -------------- | ------------------------------------------------- |
| `decks:read`   | Read decks and cards                              |
| `stats:read`   | Read learning statistics                          |
| `decks:write`  | Create/update/delete decks and cards              |
| `study:write`  | Start sessions and record reviews                 |
| `media:write`  | Request media upload intents                      |
| `study:render` | **[R6]** Render the MCP Apps study-session widget |

### 9.4 Tools

| Tool                   | Scope          | Purpose                                                            |
| ---------------------- | -------------- | ------------------------------------------------------------------ |
| `list_decks`           | `decks:read`   | List compact deck summaries                                        |
| `get_deck`             | `decks:read`   | Read deck metadata and optional cards                              |
| `search_cards`         | `decks:read`   | Search/filter cards                                                |
| `get_card`             | `decks:read`   | Read full card content                                             |
| `get_learning_stats`   | `stats:read`   | Read accuracy, due cards, weak cards                               |
| `get_study_plan`       | `stats:read`   | Request Clef-informed plan                                         |
| `create_deck`          | `decks:write`  | Create deck                                                        |
| `create_cards`         | `decks:write`  | Bulk-create cards                                                  |
| `import_deck`          | `decks:write`  | Import CSV/TSV/JSON                                                |
| `update_card`          | `decks:write`  | Update one card                                                    |
| `delete_card`          | `decks:write`  | Soft-delete card                                                   |
| `start_study_session`  | `study:write`  | Start a session                                                    |
| `record_review`        | `study:write`  | Append review result                                               |
| `get_study_session`    | `decks:read`   | Fetch the current authoritative session snapshot                   |
| `render_study_session` | `study:render` | Return the MCP Apps flashcard study widget for an existing session |

### 9.5 Token efficiency

Compact projections; default page size 20 (max 50); truncate card text in lists; cursor pagination; ids and summaries not raw rows; `get_card` for full content; structured errors with stable codes. **[R4]** `search_cards` is keyset-paginated in SQL with the due-state filter applied in the database (no per-card learning-state lookups), so large card sets stay fast.

### 9.6 Code execution [R10]

The optional `code` tool was removed for the public v0.1 release. The previous implementation injected a typed SDK but executed in the Worker module scope with normal globals reachable, so it could not honestly be described as a sandbox. Code Mode stays deferred until a real isolation seam exists.

### 9.7 Audit requirements

Every MCP write records user id, tool name, action, input summary, affected resource ids, request id, and timestamp in `mcp_audit_events`.

### 9.8 MCP Apps study-session UI [R6]

Add an optional MCP Apps-compatible UI so an LLM chat can request and conduct a real flashcard study session without leaving the conversation.

#### Interaction flow

```text
User: “Start a 10-minute review session from my Spanish A1 deck.”
  → LLM calls start_study_session
  → API creates session, selects cards, returns structuredContent
  → LLM calls render_study_session({ sessionId })
  → MCP returns UI resource + session snapshot
  → User studies and grades cards in the embedded widget
  → Widget calls record_review through the MCP Apps bridge
  → Server appends immutable review events and returns updated state
```

#### Decoupled tool pattern

Use separate data and render tools:

- `start_study_session` — creates the session, applies Clef/scheduler rules, and returns `structuredContent`; it does not declare a UI resource.
- `get_study_session` — returns the current authoritative session snapshot; no UI.
- `record_review` — appends an immutable review event; no UI.
- `render_study_session` — accepts `sessionId`, verifies ownership, and returns the MCP Apps UI resource plus a compact session snapshot. This is the only tool that declares UI metadata.

Every MCP workflow must remain fully usable without the UI.

#### UI resource

Publish a versioned HTML resource:

```text
ui://takhtabush/study-session/v1.html
```

The render tool declares:

```json
{
   "_meta": {
      "ui": {
         "resourceUri": "ui://takhtabush/study-session/v1.html"
      }
   }
}
```

Serve the resource from:

```text
/mcp-apps/study-session/v1.html
```

with MIME type:

```text
text/html;profile=mcp-app
```

Treat the resource URI as a cache key. Publish a new URI, such as `v2.html`, for breaking widget changes.

#### Widget scope

The first widget supports only an active study session:

- Deck title and progress, for example `7 / 15`
- Current card front
- Reveal answer
- Card back
- Grade actions: `again`, `hard`, `good`, `easy`
- Auto-graded modes where applicable
- Session progress and completion state
- Resume state derived from the server session

It does not support deck editing, import, AI generation, media upload, settings, or multi-session management in v1.

#### Preact implementation

Create `@caly/study-widget` as a small standalone Preact bundle. Reuse shared Zod contracts, grading helpers, visual tokens, and study-card domain logic. Do not embed the full `@caly/webapp` SPA in an iframe. To keep the two surfaces identical, the study interaction components (`StudyCard`, `MatchingPairs`, `StudyCardShell`, `ChoiceOptions`, `GradeBar`) live in `@caly/ui/study` and the design tokens in `@caly/ui/styles/theme.css`, imported by both the app and the widget.

The widget:

- Receives the session snapshot through the MCP Apps tool result
- Initializes the MCP Apps bridge
- Renders one card at a time, except `matching.pairs`, which renders a four-card two-column layout
- Calls `record_review` through `tools/call`
- Updates from the returned authoritative snapshot
- Keeps only ephemeral local state, such as whether the current answer is revealed

#### MCP Apps bridge

Use the portable MCP Apps JSON-RPC/postMessage bridge:

| Need                         | Method                         |
| ---------------------------- | ------------------------------ |
| Link render tool to UI       | `_meta.ui.resourceUri`         |
| Initialize widget            | `ui/initialize`                |
| Confirm initialization       | `ui/notifications/initialized` |
| Receive session/tool result  | `ui/notifications/tool-result` |
| Submit a review              | `tools/call` → `record_review` |
| Update model-visible context | `ui/update-model-context`      |

Use `window.openai.widgetState` only as an optional, feature-detected ChatGPT extension for ephemeral presentation preferences. It must never be the source of truth for sessions, scheduler state, or review history.

#### Security

- The widget operates under the same authenticated user and API-key/session authorization model as other MCP tools.
- `render_study_session` must verify that the session belongs to the authenticated user.
- `record_review` must validate session ownership, card ownership, response enum, and rate limits.
- The widget receives compact DTOs, never raw D1 rows, scheduler internals, or provider credentials.
- CSP must allow only the exact API origin required by the widget.
- Treat tool results and host messages as untrusted input.
- Every widget-initiated write remains server-authoritative and append-only.

#### Failure behavior

| Failure                        | Behavior                                                        |
| ------------------------------ | --------------------------------------------------------------- |
| Widget fails to load           | Return the session data and a deep link to `/study/:sessionId`  |
| Review submission fails        | Show retry; do not treat local scheduler state as authoritative |
| Session no longer active       | Show resumed/completed/abandoned state from the server          |
| Host does not support MCP Apps | `render_study_session` is unavailable; data tools still work    |

## 10. UI/UX specification

### 10.1 Design system

Preact is the only UI runtime. React imports resolve to `preact/compat` in both Vite and TypeScript. `preact-iso` handles routing (plain `<a href>`, no `Link` export). shadcn/Base UI primitives; Tailwind CSS v4 with OKLCH CSS variables; dark mode via `.dark`. **[R6]** The design tokens live in `@caly/ui/styles/theme.css`, imported by the app and the MCP Apps widget.

### 10.2 Base UI compatibility gate

Verify `Dialog`, `DropdownMenu`, `Select`, `Popover`, `Tabs` under `preact/compat`. **[R2]** In practice Button/Card/Dialog use Base UI; the remaining primitives (Select, Tabs, Switch, DropdownMenu, Tooltip, RadioGroup) are token-styled native elements to guarantee Preact behaviour.

### 10.3 Core UI components

Navigation (header nav), decks (Card, Badge, Button, Input, Dialog, Table), card editor (Select, Textarea, Input, MediaPicker), study (Card, Button, Progress, Badge; shared `StudyCardShell` / `ChoiceOptions` / `GradeBar` in `@caly/ui/study`), statistics (Card, Table), MCP/settings (Table, Badge, code block).

### 10.4 Screens

| Screen                     | Purpose                                        |
| -------------------------- | ---------------------------------------------- |
| `/`                        | Dashboard: counts, recent decks, quick actions |
| `/login`                   | Magic-link sign-in (dev link shortcut)         |
| `/decks`                   | Deck library                                   |
| `/decks/:id`               | Deck overview, card table, tags, study actions |
| `/decks/:id/edit`          | Deck settings                                  |
| `/decks/:id/cards/:cardId` | Card editor                                    |
| `/decks/:id/import`        | CSV/TSV/JSON import                            |
| `/study/:sessionId`        | Active study session (per-mode)                |
| `/stats/:deckId`           | Accuracy, due forecast, weak cards             |
| `/settings`                | Profile, **[R2]** sessions, study defaults, AI |
| `/mcp`                     | **[R2]** API keys + connection instructions    |

### 10.5 Study interaction

- `flashcards`: show front -> reveal -> grade `again`/`hard`/`good`/`easy`. **[R5]** The prompt and its revealed answer both render as prominent, equal-weight text (the answer is never shown in the muted secondary colour).
- `multiple_choice` / `matching.choice`: **[R5]** options render as a large tappable grid, each carrying a small numeric key hint (`1`–`n`); correct/incorrect feedback; auto-grade.
- `typed` / `cloze`: **[R5]** the input is auto-focused for every new card; text input with normalized comparison and the correct answer shown on miss.
- `matching.pairs`: two-column association over a batch of cards **[R2]**.
- `mixed`: dispatch per card type.

Reviews are recorded optimistically; the API appends the event and returns updated scheduler state. Keyboard: `Space` reveal, `1`–`4` grade, **[R5]** `1`–`n` to pick a multiple-choice option. **[R4]** Exiting opens a dialog to either **Pause & resume later** (keeps the session active and resumable from the dashboard) or **Abandon session** (marks it abandoned) — leaving is never implicit.

### 10.6 Empty and error states

Every screen defines an empty state with a primary action, a loading skeleton, an error state with retry, a permission/auth state, and an AI-unavailable state that preserves manual functionality.

## 11. Preact implementation rules

### 11.1 Vite aliases

Absolute regex aliases for `react`, `react-dom`, `react-dom/client`, `react/jsx-runtime`, `react/jsx-dev-runtime`, with `reactAliasesEnabled: false` on the Preact preset and `process.env.IS_PREACT` defined.

### 11.2 TypeScript aliases

`jsx: "react-jsx"`, `jsxImportSource: "preact"`, `skipLibCheck: true`, and mirrored `paths` for `react`/`react-dom` in both webapp and ui.

### 11.3 Runtime rules

Import hooks from `'react'`, not `preact/hooks`. Never add `react`/`react-dom` as runtime dependencies. No React Router. Keep route components thin; data access in feature hooks/services.

## 12. Worker configuration

### 12.1 Bindings

```jsonc
{
   "name": "takhtabush",
   "main": "packages/api/src/index.ts",
   "compatibility_date": "2026-07-29",
   "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],
   "assets": {
      "directory": "packages/webapp/dist/client",
      "binding": "ASSETS",
      "not_found_handling": "single-page-application",
      // Worker-first for API/MCP/OAuth paths; otherwise the SPA fallback answers
      // document navigations to /mcp-apps/* with index.html (SPEC A12.3).
      "run_worker_first": [
         "/api/*",
         "/mcp",
         "/mcp/*",
         "/mcp-apps/*",
         "/media/*",
         "/oauth/*",
         "/.well-known/*",
      ],
   },
   // Production omits the ids so Appflare/Cloudflare/Wrangler can provision.
   "d1_databases": [{ "binding": "DB", "migrations_dir": "migrations" }],
   "r2_buckets": [{ "binding": "MEDIA" }],
   "kv_namespaces": [{ "binding": "OAUTH_KV" }],
   "send_email": [{ "name": "EMAIL" }],
   "ai": { "binding": "AI" },
   "observability": { "enabled": true },
}
```

**[R2]** `compatibility_date` is `2026-07-29` (the newest supported by the bundled workerd). `send_email` provides the `EMAIL` binding. **[R6]** `run_worker_first` keeps `/api/*`, `/mcp`, `/mcp-apps/*`, and `/media/*` on the Worker so the SPA fallback never answers them. **[R8]** The root `wrangler.jsonc` is the production/Appflare/Deploy-to-Cloudflare config; `wrangler.dev.jsonc` keeps the local ids, dev vars, and dev `SESSION_SECRET`.

### 12.2 Environment type

```ts
export type AppEnv = {
   DB: D1Database;
   MEDIA: R2Bucket;
   EMAIL: SendEmail; // [R2]
   AI: Ai;
   ASSETS: Fetcher;
   APP_URL: string;
   SESSION_SECRET: string;
   EMAIL_FROM: string; // [R2]
   ENVIRONMENT: string; // [R2] "development" | "production"
   OWNER_INVITE_TOKEN?: string; // [R2]
   OWNER_EMAIL?: string; // [R8]
   ALLOWED_EMAILS?: string; // [R8]
   SETUP_TOKEN?: string; // [R8]
   MCP_DEV_NO_AUTH?: string; // development only
   MCP_DEV_USER_EMAIL?: string; // development only
   AI_GATEWAY_URL: string;
   AI_GATEWAY_TOKEN?: string;
   CLEF_MODEL: string;
};
```

### 12.3 Route precedence

1. `/api/v1/*` -> Hono API
2. `/mcp` -> API keys/session (Hono) or OAuth provider
3. `/mcp` (OAuth bearers), `/mcp/oauth`, `/oauth/*`, `/.well-known/*` -> OAuth provider + MCP handler
4. `/mcp-apps/*` -> MCP Apps UI resources
5. `/media/*` -> authenticated R2 proxy
6. Everything else -> static SPA assets with SPA fallback

## 13. Local development

| Service         | URL                                                    |
| --------------- | ------------------------------------------------------ |
| Unified Worker  | `http://localhost:8787`                                |
| Vite dev server | `http://localhost:5173`                                |
| MCP endpoint    | `http://localhost:8787/mcp`                            |
| OAuth MCP       | `http://localhost:8787/mcp` (or `/mcp/oauth`)          |
| MCP Apps widget | `http://localhost:8787/mcp-apps/study-session/v1.html` |

```bash
pnpm install
pnpm db:migrate:local   # required: creates all tables in local D1
pnpm dev                # SPA on :5173 + unified Worker on :8787
```

**[R2]** `wrangler dev` simulates email delivery (logged, not sent) and provides a dev-only `SESSION_SECRET`, so magic-link sign-in works immediately; in development the login screen shows an "Open sign-in link" shortcut.

**[R3]** The cleanup job runs on a daily cron; test it via the unit test or by running the scheduled handler with `wrangler dev --test-scheduled`. **[R6]** The Vite dev server proxies `/mcp-apps` to the Worker so the widget can be embedded same-origin during development.

## 14. Testing

### 14.1 Required tests

| Area           | Tests                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------- |
| Shared schemas | Valid/invalid payloads, cursor encode/decode, media limits                                        |
| Scheduler      | Response transitions, due dates, lapses, versioning, rebuild                                      |
| Grading        | Normalization, typed/cloze checks, cloze masking                                                  |
| Journey        | Deterministic strategy/card selection                                                             |
| Import         | CSV/TSV/JSON parsing, quoted delimiters, malformed rows                                           |
| Clef           | Response normalization, invalid rejection                                                         |
| Auth           | Magic-link request/verify, dev-token gating, invite gate, rate limit, session list/revoke, logout |
| MCP            | Scope intersection, API-key tools/list, write denial, unknown key                                 |
| API            | Health, routing, ownership, error envelopes, pagination                                           |
| MCP Apps       | Render-tool authorization, UI metadata, session ownership, review submission, fallback link       |

**Current status:** shared 21, api 38, mcp 8 tests. Still missing: R2 upload lifecycle unit tests, UI interaction tests, repository-level CRUD tests, session lifecycle route tests.

### 14.2 Quality gates

```bash
pnpm lint && pnpm check-types && pnpm test && pnpm build:all && pnpm knip && pnpm db:migrate:check
```

## 15. Deployment

### 15.1 Pipeline

1. Install with frozen lockfile. 2. Lint, typecheck, test, build. 3. Apply D1 migrations. 4. Deploy the unified Worker. 5. Smoke-test `/health`, an SPA route, an authenticated API route, `/mcp`, and the MCP Apps widget resource.

**[R8] Configs:** `wrangler.jsonc` is the production/Appflare/Deploy-to-Cloudflare config. It omits the D1 id, R2 bucket name, and production secrets so Appflare, Cloudflare, or Wrangler can provision and fill them. Local development uses `wrangler.dev.jsonc`.

**[R2] Outstanding:** create the real D1 database (`wrangler d1 create`) and set its id, configure the route/zone, and onboard a sending domain for `EMAIL_FROM`.

### 15.2 Secrets

Store in Wrangler/CI secrets: `SESSION_SECRET`, `SETUP_TOKEN`, `AI_GATEWAY_TOKEN` (optional), `OWNER_INVITE_TOKEN` (optional), and the Email Service sender domain configuration. `OWNER_EMAIL` and `ALLOWED_EMAILS` are ordinary vars. Never commit secrets, database ids, or production tokens.

### 15.3 First run and Appflare

`SETUP_TOKEN` enables `/setup`: it creates the owner while `users` is empty and recovers owner access later. Appflare's manifest draft lives at `deploy/appflare.jsonc`; it points at `wrangler.jsonc`, runs `pnpm build`, provisions D1/R2, and applies `migrations/`. Email delivery still needs an onboarded sender domain; the setup token is the fallback.

## 16. Implementation plan

### Phase 1 — Tracer bullet — **[R2] Done**

Monorepo + unified Worker; Preact/Vite/Tailwind/shadcn; D1 migrations and repositories; auth, decks, cards, tags; flashcard study + review events; CSV/TSV/JSON import/export.

### Phase 2 — Learning engine — **[R2] Done**

Learning state + versioned scheduler; multiple-choice, typed, cloze, and matching modes (**two matching variants**); study-session history and deck statistics; R2 media upload and image/audio cards.

### Phase 3 — MCP and Clef — **[R2] Mostly done**

**API-key** and OAuth 2.1 auth on `/mcp` (with `/mcp/oauth` as an alias); stateless MCP endpoint; curated read/write tools and audit logging; `get_study_plan` with deterministic fallback; Clef through AI Gateway. Remaining: harden the `code` tool sandbox.

### Phase 4 — Optional AI authoring — Deferred

AI Gateway model picker; sidebar chat/generation; draft cards only; explicit approval; usage/cost visibility.

### Phase 6 — MCP Apps study-session UI — **Implemented (server + compiled widget); host validation pending**

1. Extract reusable study-card components and shared session contracts. — done (`@caly/ui/study`, `@caly/shared` snapshot + `interactionFor`).
2. Create `@caly/study-widget` as a small Preact bundle. — done (compiled single-file resource).
3. Add `get_study_session` and `render_study_session` MCP tools. — done.
4. Serve `ui://takhtabush/study-session/v1.html` as an MCP Apps resource. — done.
5. Implement `ui/initialize`, tool-result rendering, and `tools/call` for `record_review`. — done.
6. Add ownership, scope, rate-limit, audit, and fallback-link tests. — partial (scope + UI metadata + snapshot tests; host-bridge tests pending).
7. Test with MCP Inspector, then a ChatGPT custom MCP server connection. — pending.

## 17. Definition of done

- One `pnpm deploy` deploys the unified Worker.
- A user can sign in, manage sessions, create/edit/delete decks and cards (all types), import decks, and study in every mode (both matching variants).
- Review events persist and the scheduler schedules future reviews.
- D1 holds all structured data; R2 holds only media.
- The SPA handles deep links such as `/decks/:id` and `/study/:sessionId`.
- Clef-powered recommendations work through AI Gateway and fall back safely.
- MCP clients authenticate with an API key, read decks/stats, create/import cards, and start sessions; responses are compact, paginated, scoped, and audited.
- Auth is rate limited; magic links deliver through the Email Service in production.
- CI passes lint, typecheck, tests, build, migration checks, and Knip.
- **[R6]** A compatible chat host can create a session through MCP and render/study it in an embedded widget; reviews synchronize through the same append-only review-event model.

## 18. Explicit non-goals

Multi-tenant organizations and billing; realtime collaborative editing; public marketplace; native mobile apps; offline-first sync; automatic AI card generation without approval; direct Clef access from MCP clients; exposing raw SQL/D1/R2 through MCP. Embedding the full web app in a chat host; deck editing or AI generation inside the initial MCP Apps widget. Server-side rendering of the widget resource (the resource is a static, data-free shell; data arrives through the tool result).

## 19. Key decisions

| ID  | Decision                                                                                                                                                    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Deploy one unified Cloudflare Worker for SPA, API, media, and MCP                                                                                           |
| D2  | Single tenant by default; retain `owner_id` for future evolution                                                                                            |
| D3  | D1 is authoritative; R2 stores only binary media                                                                                                            |
| D4  | Review events are append-only and rebuildable into learning state                                                                                           |
| D5  | Clef makes decisions over existing cards; it does not generate content                                                                                      |
| D6  | Clef is exposed only through `get_study_plan`                                                                                                               |
| D7  | AI content generation is deferred and must produce user-approved drafts                                                                                     |
| D8  | MCP uses curated workflow tools only; no code execution is exposed **[R10]**                                                                                |
| D9  | Full search-and-execute Code Mode is deferred until a real isolation seam exists                                                                            |
| D10 | MCP never accesses D1/R2 directly                                                                                                                           |
| D11 | All AI calls go through AI Gateway and degrade gracefully                                                                                                   |
| D12 | Base UI must pass a Preact compatibility gate before feature development                                                                                    |
| D13 | **[R2]** Magic links deliver through the Cloudflare Email Service `EMAIL` binding                                                                           |
| D14 | **[R2]** Auth routes are rate limited (D1 fixed window) with `Retry-After`                                                                                  |
| D15 | **[R2]** MCP authenticates with scoped API keys on `/mcp`; **[R9]** ChatGPT uses OAuth 2.1 on the same `/mcp` resource                                      |
| D16 | **[R2]** Sessions are first-class: list and revoke individually or in bulk                                                                                  |
| D17 | **[R2]** `matching` ships two variants: `pairs` and `choice`                                                                                                |
| D18 | **[R2]** Answer grading is normalized and lives in `@caly/shared`                                                                                           |
| D19 | **[R3]** A scheduled cleanup job prunes auth artifacts and orphaned R2 media                                                                                |
| D20 | **[R3]** Cards can be suspended/resumed; suspended cards are excluded from automatic sessions                                                               |
| D21 | **[R3]** Auto-graded modes derive `again`/`hard`/`good`/`easy` from performance                                                                             |
| D22 | **[R3]** Study sessions have a full lifecycle: list, resume, complete, abandon                                                                              |
| D23 | **[R4]** API keys may expire; there is no key rotation or per-key rate limit                                                                                |
| D24 | **[R4]** MCP `search_cards` is keyset-paginated in SQL (due filter in the database)                                                                         |
| D25 | **[R4]** Suspension is `cards.status`; `learning_state.suspended` was removed                                                                               |
| D26 | **[R4]** Import validates structure client-side; the parser lives in `@caly/shared`                                                                         |
| D27 | **[R4]** Deck and card lists paginate with a cursor to stay responsive                                                                                      |
| D28 | **[R5]** Card deletion is soft and undoable; the cleanup job purges it permanently after 30 days                                                            |
| D29 | **[R5]** Import parsing is configurable (column delimiter + tag separator) with a live preview                                                              |
| D30 | **[R6]** Add an optional MCP Apps-compatible study-session widget; core MCP workflows remain usable without UI                                              |
| D31 | **[R6]** Use a decoupled flow: `start_study_session` returns data; `render_study_session` returns the UI resource                                           |
| D32 | **[R6]** Build a small standalone Preact study widget; do not embed the full web app in ChatGPT                                                             |
| D33 | **[R6]** The widget renders server-authoritative snapshots and submits reviews through `record_review`; it has no independent source of truth               |
| D34 | **[R6]** Reuse one set of presentational study components (`@caly/ui/study`) and shared design tokens between the app and the widget                        |
| D35 | **[R6]** The widget resource is a static, data-free shell (`run_worker_first` keeps `/mcp-apps/*` on the Worker); data arrives via the tool result, not SSR |
| D36 | **[R9]** `/mcp` is both the API-key endpoint and the OAuth resource; API keys/sessions bypass the provider, and consent reuses the magic-link session       |

## 20. Revision history

- **Revision 1** — original unified Worker spec.
- **Revision 2 (2026-10-13)** — MCP auth switched to API keys; added Cloudflare Email Service magic links, auth rate limiting, session management, API-key management, R2 media upload, all card types, per-mode study screens with two matching variants, shared grading helpers, and the `rate_limits`/`api_keys` tables and `ai_evaluations.status`.
- **Revision 3 (2026-10-14)** — scheduled cleanup job (auth artifacts + orphaned R2 media); card suspend/resume; performance-based grading so all four responses appear; selectable study goals; complete session lifecycle (list/resume/abandon).
- **Revision 4 (2026-10-14)** — optional API key expiration; `search_cards` SQL keyset pagination (removes the N+1 state lookup); removed the dead `learning_state.suspended` column; explicit pause-vs-abandon on session exit; import file upload with shared client-side validation and an export menu; cursor pagination for the deck and card lists.
- **Revision 5 (2026-10-14)** — consistent card deletion: soft delete with in-place confirmation and undo (`POST /cards/:id/restore`); statistics exclude deleted cards everywhere; the cleanup job hard-deletes cards soft-deleted over 30 days, together with their review events, revisions, and learning state. Study interaction polish (large choice grid with key hints, equal-weight prompt/answer, auto-focused typed input). Configurable import parsing (column delimiter + tag separator) with a live preview table.
- **Revision 6 (2026-10-14)** — added an optional MCP Apps-compatible study-session UI: `render_study_session` returns `ui://takhtabush/study-session/v1.html`; `get_study_session` provides the authoritative snapshot; the standalone Preact widget records reviews through `record_review`; added the `study:render` scope, widget route, security rules, tests, and implementation phase. The widget reuses `@caly/ui/study` presentational components and `@caly/ui/styles/theme.css` tokens so it stays in sync with the app; `run_worker_first` keeps `/mcp-apps/*` on the Worker.

- **Revision 7 (2026-10-14)** � card definitions are stored as raw Markdown and edited with an inline WYSIWYG editor; every read surface renders Markdown; typed grading and compact previews flatten it to plain text.
- **Revision 8 (2026-10-20)** � single tenancy (owner, `ALLOWED_EMAILS`, `OWNER_EMAIL`, one-owner index); first-run setup/recovery through `SETUP_TOKEN`, `/auth/status`, and `/auth/setup`; the production `wrangler.jsonc`, the Appflare repository-install path, the catalog manifest draft, and `pnpm build` / `pnpm deploy`.
- **Revision 9 (2026-10-21)** — OAuth 2.1 for ChatGPT: `/mcp` is protected by `@cloudflare/workers-oauth-provider` with CIMD/DCR, PKCE, token/refresh handling, and RFC 9728/8414 discovery; API keys and sessions bypass the provider. `/mcp/oauth` is a path-descendant alias, `/oauth/authorize` reuses the magic-link session, and `OAUTH_KV` stores grants.
- **Revision 10 (2026-10-21)** — open-source packaging: the project is published as **Takhtabush** under the MIT license. The unsandboxed `code` tool and `codemode:execute` scope were removed; MCP `tools/list` and the study widget resource are now scope-gated; the study-widget resource URI moved to `ui://takhtabush/study-session/v1.html`.
