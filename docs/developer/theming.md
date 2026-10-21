# Theming

Theming uses CSS-variable token sets in
`packages/webapp/src/styles/globals.css`, managed by the shadcn CLI. Theme
presets change tokens, not component implementations.

- Single Tailwind entry: `packages/webapp/src/styles/globals.css`.
- Generated primitives live in `packages/ui` and are scanned via
  `@source '../../../ui/src'`.
- Toggle dark mode with the `.dark` class (see `lib/theme.tsx`).

Apply a preset from the webapp:

```bash
pnpm --filter @caly/webapp theme:apply -- --preset <PRESET_CODE>
```

Keep `style`, `baseColor`, `iconLibrary`, and Tailwind settings identical
between `packages/webapp/components.json` and `packages/ui/components.json`.
