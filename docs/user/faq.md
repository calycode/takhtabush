# FAQ

### Do I need a Cloudflare account?

Only if you are self-hosting. If someone else runs the instance, you just need
the app URL and an email address.

### Where is my data?

Decks, cards, review events, and learning state are in the instance's D1
database. Images and audio are in R2. The operator controls backups. Export a
deck from its menu if you want your own copy.

### Can I share a deck?

Not in this release. The app is single tenant by default, and decks are private
to their owner. A shared workspace is a planned fork, not a current feature.

### Can I use it offline?

No. The app is a web app backed by a Worker and D1. A network connection is
required.

### Is there a mobile app?

No native app. The web app is responsive and works in a phone browser.

### How many new cards and reviews per day?

20 new cards and 200 reviews. These are fixed in the current release.

### Why is a card missing from my session?

It may be suspended, deleted, or scheduled for a later date. Check the deck
table and the [progress page](progress.md).

### How do I reset a card's progress?

There is no per-card reset in this release. You can delete and recreate the
card, or delete the deck and import it again. Deleting is soft for a short
window, so act carefully.

### How do I delete my account?

There is no self-service deletion. Ask the operator to remove the account and
its data from the database.

### Is Takhtabush free?

The code is MIT licensed and free to self-host. Your Cloudflare usage (Workers,
D1, R2, Email, AI) is billed by Cloudflare. There is no paid plan in this
release.

### Can I use it commercially?

The MIT license allows commercial use. Keep the copyright and permission notice.

### Who do I contact about a security issue?

Use the private advisory link in [`SECURITY.md`](../../SECURITY.md). Do not open
a public issue.
