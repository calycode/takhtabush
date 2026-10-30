# Decks and cards

## Decks

A deck is a set of cards with a title, an optional Markdown description, and
tags derived from its cards. The deck page shows a searchable table with the
front, answer, type, tags, and a menu for each card.

Deck actions include **Study**, **Add card**, and **Export**. The deck menu also
has edit, collection, export, and delete actions.

## Card types

| Type              | Use it for                                          | Required fields                             |
| ----------------- | --------------------------------------------------- | ------------------------------------------- |
| Term / definition | Vocabulary, facts, paired concepts                  | Front, back                                 |
| Cloze             | A sentence with one hidden word: `El {{perro}} es…` | Cloze text                                  |
| Multiple choice   | Recognition practice                                | Front, two to eight choices, correct choice |
| Typed             | Recall by typing the answer                         | Front, back                                 |
| Image prompt      | A prompt anchored to an image                       | Front, image                                |

Text answers are compared after normalising case, accents, punctuation, and
whitespace. Cloze answers must match the hidden word.

## Markdown

Definitions and descriptions are Markdown. You can use:

- `**bold**`, `*italic*`, and `` `code` ``
- links and lists
- line breaks

The deck table and study screen render the same Markdown. The search and
compact card summaries flatten it to plain text.

## Tags and collections

- Tags are free-form labels on a card. Use the tag picker or type a new tag.
- The deck page has a tag filter and shows tag counts. Tag suggestions are
  generated from your cards; a brand-new tag can take a few minutes to appear in
  the global suggestion list.
- Collections group decks in the library. A deck belongs to at most one
  collection (or none), and a collection has no sub-collections.
- Create a collection from the deck library, then move decks into it from the
  deck's ⋯ menu or from the deck settings page. Use the filter chips to show
  **All decks**, **No collection**, or one collection.
- Rename a collection with its ✎ button and move it up or down with ↑/↓. The
  order is saved on the server; there is no drag-and-drop.
- Deleting a collection keeps its decks; they simply become unfiled.

Tags describe card content and are the easiest way to build a study subset:
filter by a tag, then use the study launcher. Collections describe where a deck
lives, so they never need to move a card or change a tag.

## Editing, deleting, and suspending

- **Edit** a card from its row menu.
- **Delete** is soft. The card disappears from lists and the deck count, and
  the app offers an undo action for a short window. The cleanup job purges old
  deletions later.
- **Suspend** keeps the card in the deck but removes it from automatic study
  sessions, due counts, new counts, and weak-card queues. Resume it when you
  want it back.
- **Restore** brings back a recently deleted card.

## Images and audio

Images and audio are stored in R2 and read through an authenticated media
proxy. Upload from the card editor. A media object belongs to the account that
uploaded it.

## Import and export

The deck menu exports CSV, TSV, or JSON. The import screen accepts the same
formats with a header row, a delimiter choice, and a tag separator. See
[Import and export](import-export.md).

## Limits

The current release has fixed daily study limits: **20 new cards** and
**200 reviews** per day. These are not yet configurable in the UI.

A deck holds at most **500 cards**, a single import is limited to **500 rows**,
and a card has at most **20 tags** (40 characters each). A collection holds at
most **200 decks**, and an account at most **100 collections**. The deck page
shows the current card count against the cap; when a deck is full, delete cards
or split it into another deck before adding more. See
[Import and export](import-export.md) for the import limit.
