# Getting started

## Sign in

1. Open the app URL.
2. Enter your email address.
3. Open the sign-in link you receive. It expires after 15 minutes.

If your instance does not send email yet, the operator can create the owner
account from `/setup`; ask them for the setup token. In local development the
sign-in screen may show an **Open sign-in link** shortcut instead of sending
mail.

## Your dashboard

The dashboard is the home screen:

- **Decks** — how many decks you have.
- **Cards** — the total across those decks.
- **Latest deck** — the most recently updated deck.
- **Continue studying** — sessions you paused but did not abandon.
- **Your decks** — open a deck, study it, or use the deck menu.

## Create a deck

1. Choose **New deck**.
2. Give it a title and an optional description.
3. Save.

The description is Markdown, so you can add emphasis, links, or a short list.

## Add a card

1. Open the deck.
2. Choose **Add card**.
3. Pick a type:
   - **Term / definition** — a prompt and an answer.
   - **Cloze** — a sentence with a hidden word written as `{{word}}`.
   - **Multiple choice** — two to eight choices and the correct one.
   - **Typed** — a prompt with an answer you type.
   - **Image prompt** — a prompt that needs an uploaded image.
4. Add optional tags and media.
5. Save.

You can edit a card at any time from its row in the deck table. Deleting a card
is soft and undoable for a short window.

## Start studying

1. Open the deck and choose **Study**.
2. Pick a **mode** (how you want to practice), a **goal** (why you are studying),
   and a **time limit**.
3. Start the session. The app builds a plan from what is due, what is weak, and
   what is new.

See [Studying](studying.md) for the modes and keyboard shortcuts.

## If you get stuck

- **No email arrived** — check spam, then ask the operator whether email
  delivery is configured. `/setup` can create or recover the owner account.
- **A card is not appearing** — it may be suspended, deleted, or scheduled for a
  later date. See [Decks and cards](decks-and-cards.md) and
  [Progress](progress.md).
- **You cannot add a second account** — the default deployment is single tenant.
  The owner can allow more addresses; see the
  [self-hosting guide](../developer/self-hosting.md).
