# Decks and cards

## Decks

A deck is a set of cards with a title, an optional Markdown description, and
tags derived from its cards. The deck page shows a searchable table with the
front, answer, type, tags, and a menu for each card.

Deck actions include **Study**, **Add card**, and **Export**. The deck menu also
has rename, delete, and folder actions where available.

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

## Tags and folders

- Tags are free-form labels on a card. Use the tag picker or type a new tag.
- The deck page has a tag filter and shows tag counts.
- Folders group decks on the dashboard. A folder can have a parent folder.

Tags are the easiest way to build a study subset: filter by a tag, then use the
study launcher.

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
