# Branding

`takhtabush-logo.svg` is the master mark (green `#087F43`, gold `#BA8B35`). Every
shipped raster is generated from it, so replace this file and run:

```sh
pnpm brand:generate
```

The script writes:

- `packages/webapp/public/` — app icon set, favicons, and `logo.svg`
- `docs/_media/` — docs favicon, README logo, docs header logo, OG image
- `packages/browser-extension/src/assets/icon.png` — extension icon source for
  `@wxt-dev/auto-icons`

Wordmarks are rendered as text (`Takhtabush`) next to the mark instead of a
second baked image, so they stay crisp and theme-aware. Commit the generated
files with the master SVG.
