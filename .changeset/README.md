# Changesets

This folder holds the pending changesets for Takhtabush. Add one with
`pnpm changeset` whenever a change should appear in the changelog.

- All `@caly/*` packages are a single fixed version group. One changeset bumps
  the whole product together, so never edit package versions by hand.
- `pnpm version-packages` turns pending changesets into version bumps and
  `CHANGELOG.md` entries for every package in the group. The first run creates
  the changelog files.
- The packages are private and are never published to npm. Do not run
  `changeset publish`.
- Commit the generated `.changeset/*.md` file together with the change that
  produced it. Check pending work with `pnpm changeset:status`.

Read the full documentation at https://changesets.dev.
