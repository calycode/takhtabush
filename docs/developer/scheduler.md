# Scheduler

The scheduler lives in `packages/shared/src/domain/scheduler.ts`. It is
SM-2-inspired, deterministic, and versioned with `SCHEDULER_VERSION = 1`.

The user-facing view of studying is in the [user guide](../user/studying.md).

## Transition

| Response | Ease change | Next interval              | Phase      |
| -------- | ----------- | -------------------------- | ---------- |
| `again`  | -0.20       | 10 minutes                 | relearning |
| `hard`   | -0.15       | 1.2 × current              | review     |
| `good`   | unchanged   | 1 day, 6 days, then × ease | review     |
| `easy`   | +0.15       | 3 days, then × ease × 1.3  | review     |

Ease is clamped to 1.3–2.8. The interval is rounded to two decimals. The same
state, response, and clock always produce the same next state.

## State and events

`review_events` are the source of truth. `learning_state` is a derived row per
`(user_id, card_id)` and can be rebuilt by folding `rebuildLearningState` over
the events. The version is stored on every learning-state row so old rows can
be migrated or rebuilt.

Bump `SCHEDULER_VERSION` whenever the math changes. Add a test that pins the new
behavior. Do not rewrite history with a migration; rebuild from events instead.

## Plans

`packages/shared/src/domain/journey.ts` builds a deterministic plan:

- Goal → strategy: `learn` and `retain` use `mixed`/`consolidate`, `review`
  uses `consolidate`, `cram` and `diagnose` use `review_weak`.
- Candidate order depends on the strategy: weak-first, due-first, new-first, or
  interleaved.
- A time budget becomes a card count with a per-mode estimate.
- Explicit `cardIds` win, but only after they are checked against the deck and
  the caller (see `filterOwnedCardIds`).

Clef may refine the strategy; it never chooses the candidate set. If Clef is
unavailable, the deterministic plan is used.

## Due, new, and weak

The API computes queues in `packages/api/src/repositories/study.ts`:

- **Due** — `learning_state.due_at <= now`, excluding suspended cards.
- **New** — active cards with no learning-state row for the user.
- **Weak** — cards below the accuracy threshold, ordered worst first.
- **Cram** — every active card in the deck, regardless of schedule.

The daily defaults are 20 new cards and 200 reviews. They are constants in
`packages/shared/src/domain/modes.ts`.

## Grading

Manual modes send one of `again`, `hard`, `good`, `easy`.

Auto-graded modes use `gradeFromPerformance` in
`packages/shared/src/domain/grading.ts`: incorrect → `again`, retry or slow →
`hard`, fast correct → `easy`, otherwise `good`. Thresholds are 3 seconds for
fast and 12 seconds for slow. Text answers normalise case, accents,
punctuation, and whitespace; cloze answers must match every hidden token.

## Testing

`packages/shared/src/domain/scheduler.test.ts` and `grading.test.ts` are the
fast tests to run when changing the math. They are pure and do not need D1.
