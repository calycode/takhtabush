# Takhtabush Extension

The `@caly/browser-extension` package is a WXT browser extension that adds a
**Clone this to my Takhtabush account** button to Quizlet set pages. It reads the visible term/definition pairs from the page, then creates
a deck in the connected Takhtabush instance through the existing MCP `create_deck` and
`import_deck` tools.

## Develop

From the repo root:

```sh
pnpm dev:extension
```

This runs WXT in dev mode, opens `https://quizlet.com/` automatically through
`web-ext`, and keeps the browser profile at `.wxt/chrome-data` between runs so
your Quizlet login survives restarts. The equivalent package command is:

```sh
pnpm --filter @caly/browser-extension dev
```

The first `pnpm install` runs `wxt prepare`, which generates the `.wxt/` type
helpers. Toolbar and store icons are generated from `src/assets/icon.png` by
`@wxt-dev/auto-icons`.

## Build and load

```sh
pnpm --filter @caly/browser-extension build
```

Then load `packages/browser-extension/dist/chrome-mv3` as an unpacked extension from
`chrome://extensions`.

## Connect

1. Open the extension settings and enter your Takhtabush instance URL.
2. Choose **Connect Takhtabush**. The regular Takhtabush sign-in flow opens.
3. Approve the request on the `/extension` page. This creates a one-year API key with
   `decks:read` and `decks:write` and hands it back to the extension.
4. Return to a Quizlet set page. The clone button appears immediately above the terms
   list (`[data-testid="terms-list"]`).

If the interactive flow is unavailable, create a key on your instance's `/mcp` page and
paste it into the extension's **Use an API key instead** section.

The key is stored in `chrome.storage.local` and sent only to your configured Takhtabush
origin as a bearer token. Revoke it from the MCP page at any time.

## Parser

`src/lib/quizlet.ts` reads the visible DOM. It looks for `[data-testid="terms-list"]`,
then all `.TermText` nodes, groups them by the nearest card row, and uses
`data-testid` values containing `definition`/`answer` to correct column order when
Quizlet swaps sides. It falls back to pairing the `TermText` nodes in document order.

Text-only for now: images, audio, and rich formatting are ignored. A Takhtabush deck
holds at most 500 cards, and sets over that limit are rejected before anything is sent.

## Tests

```sh
pnpm --filter @caly/browser-extension test
```
