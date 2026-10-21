# Studying

## Pick a mode

| Mode            | What you do                                        |
| --------------- | -------------------------------------------------- |
| Flashcards      | Read the prompt, reveal the answer, grade yourself |
| Multiple choice | Pick one of the choices                            |
| Typed           | Type the answer                                    |
| Cloze           | Fill the hidden word                               |
| Matching        | Match pairs, or pick the partner                   |
| Mixed           | Let each card's type choose the interaction        |

The launcher only offers modes the deck can support. A deck with only
term/definition cards, for example, does not offer cloze.

### Matching layouts

- **Pairs** — two columns; match each prompt to its answer.
- **Choice** — pick the partner from the options.

## Pick a goal

| Goal              | Best for                                    |
| ----------------- | ------------------------------------------- |
| Learn             | A blended mix of weak, due, and new cards   |
| Review            | Due cards first, then weak cards            |
| Revise now (cram) | Any active card, regardless of the schedule |
| Retain            | Due-first consolidation                     |
| Diagnose          | Weak cards first, then due cards            |

## Pick a time limit

The launcher turns your time budget into a card count for the chosen mode. You
can stop at any time; the session stays active until you complete or abandon it.

## Study keyboard shortcuts

- **Space** — reveal the answer (flashcards).
- **1 / 2 / 3 / 4** — grade again / hard / good / easy.
- **Esc** — open the exit dialog.

Auto-graded modes choose the grade from your answer, speed, and whether you
retried. You do not grade those manually.

## Session lifecycle

- **Start** builds a plan and creates the session.
- **Pause** happens when you leave; the session stays active and appears under
  **Continue studying** on the dashboard.
- **Resume** loads the same session and the cards you have already reviewed.
- **Complete** marks the session finished.
- **Abandon** closes it for good; it no longer appears as active.

## What the scheduler does

Every review updates when you will see the card again. A wrong answer comes
back in about ten minutes; a correct answer moves further out. The app also
tracks ease, repetitions, and lapses so it can prioritise weak cards.

You do not need to manage the schedule. If you are curious about the exact
math, see the [scheduler reference](../developer/scheduler.md).

## Daily limits

The current release uses fixed daily defaults: **20 new cards** and **200
reviews**. They are applied automatically.
