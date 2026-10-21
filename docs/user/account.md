# Account and sessions

## Sign in

Takhtabush uses email magic links. Enter your address, open the link, and you
are signed in. The link expires after 15 minutes and can be used once.

## Sessions

Open **Settings → Sessions** to see where you are signed in. Each row shows the
browser, when it started, and when it expires. You can:

- sign out one session,
- sign out every other session,
- sign out of the current session from the account menu.

Signing out revokes the session on the server, not just in your browser.

## Theme

Choose **System**, **Light**, or **Dark** in settings. The choice is stored in
your browser, not on the server.

## Owner and allowlist

The first account on a deployment is the owner. The owner can:

- allow more email addresses with `ALLOWED_EMAILS`,
- pin the owner address with `OWNER_EMAIL`,
- require an invite token with `OWNER_INVITE_TOKEN`,
- use `/setup` with `SETUP_TOKEN` to create or recover the owner.

These are deployment settings, not per-user preferences. If you are not the
operator, ask them. The full details are in the
[self-hosting guide](../developer/self-hosting.md).

## Your data

Decks, cards, review events, and learning state live in the instance's D1
database. Media lives in R2. The operator of the instance controls backups and
retention. Export a deck at any time from its menu.

## Leaving

There is no self-service account deletion in this release. The operator can
remove an account and its data from the database. If that matters to you, ask
before you invest in a large deck.
