# Use an AI assistant

Takhtabush has an MCP endpoint, so an AI assistant can read your decks, look at
statistics, create cards, and run a study session without leaving the chat.

## What you need

- The app URL.
- An API key from **Settings → MCP** (or the `/mcp` screen).
- A client that supports MCP: ChatGPT, Claude Desktop, Codex, or a script.

## Create an API key

1. Open `/mcp`.
2. Choose **Create key**.
3. Name it and select the scopes it needs.
4. Copy the secret. It is shown once.

Use the smallest set of scopes that does the job. A read-only assistant needs
`decks:read` and `stats:read`; one that also records reviews needs
`study:write`.

## Connect a client

For a client that accepts a URL and a header:

```json
{
   "mcpServers": {
      "takhtabush": {
         "url": "https://your-app.example.com/mcp",
         "headers": { "Authorization": "Bearer <key>" }
      }
   }
}
```

For ChatGPT's web connector, choose **OAuth** instead of an API key. Sign in
with the same magic link and approve the scopes.

## What the assistant can do

- List decks and search cards.
- Read one card or deck statistics.
- Create a deck, add cards, or import a CSV/TSV/JSON payload.
- Update or delete a card.
- Start a study session, record reviews, and render the study widget.

Every write is audited. The assistant cannot run arbitrary code, and it cannot
access another account's cards.

## What it cannot do

- Share a deck with someone else.
- Change your account settings or sessions.
- Bypass the daily study limits.

## More detail

The protocol details, scopes, OAuth flow, and generated tool reference live in
the [developer MCP guide](../developer/mcp.md).
