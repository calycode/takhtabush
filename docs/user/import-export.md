# Import and export

## Export a deck

Open the deck menu and choose **Export**. Pick a format:

- **CSV** — front, back, and tags separated by commas.
- **TSV** — the same columns separated by tabs.
- **JSON** — front, back, type, and tags per card.

The download is generated from the live cards in the deck.

## Import cards

1. Open a deck.
2. Choose **Import**.
3. Upload a CSV, TSV, or JSON file, or paste the content.
4. Choose whether the first row is a header.
5. For delimited files, choose the column delimiter and the tag separator.
6. Review the preview and import.

### Delimited format

The first three columns are front, back, and tags:

```csv
front,back,tags
la casa,house,spanish;basics
el libro,book,spanish;basics
```

- `delimiter` can be a comma, semicolon, tab, or detected automatically.
- `tagSeparator` controls how tags inside the third column are split (`;`, `,`,
  or `|`).
- A header row is optional.

### JSON format

```json
[
   { "front": "la casa", "back": "house", "tags": ["spanish", "basics"] },
   { "front": "el libro", "back": "book", "tags": ["spanish", "basics"] }
]
```

## What happens on import

- Rows are capped per import.
- Cards are deduplicated by **front**: an existing card with the same front is
  updated instead of duplicated.
- Empty rows and malformed rows are reported instead of silently dropped.
- Imported cards are term/definition cards with the source marked as `import`.
- Tags from the file and the import form are combined, up to 20 tags.

## Tips

- Export before a large edit so you have a copy.
- Use tags in the third column to build study subsets.
- Keep one concept per card; long cards are harder to grade.
