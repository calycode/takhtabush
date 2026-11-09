# Theming

Theming uses CSS-variable token sets in
`packages/webapp/src/styles/globals.css`, managed by the shadcn CLI. Theme
presets change tokens, not component implementations.

- Single Tailwind entry: `packages/webapp/src/styles/globals.css`.
- Generated primitives live in `packages/ui` and are scanned via
  `@source '../../../ui/src'`.
- Toggle dark mode with the `.dark` class (see `lib/theme.tsx`).

## Pixel skin

The opt-in pixel shell is a CSS skin over the same primitives, not a second
component set. **Settings → Preferences → Pixel UI** sets `data-ui="pixel"` on
`<html>`; `packages/ui/src/styles/pixel.css` restyles the shared components
through their `data-slot` attributes and zeroes the radius tokens.

- Keep skin rules in `pixel.css` and target `data-slot` hooks; do not fork the
  primitives. A `pixel:` Tailwind variant is available for one-off overrides.
- The arcade keeps its own `Bit*` components. They are marked `data-bit`, which
  the skin skips.
- Prose, form values, and long labels keep the sans stack. The pixel face is
  limited to headings and short chrome strings.

Tune the look from the variables block at the top of `pixel.css`:

| Variable                               | Effect                                                      |
| -------------------------------------- | ----------------------------------------------------------- |
| `--pixel-radius`                       | Corner radius. `0` is square; try `2px`–`4px` to soften it. |
| `--pixel-edge-color`                   | Border ink. Use `var(--border)` for a softer outline.       |
| `--pixel-edge-width`                   | Border weight on buttons, inputs, chips, and cards.         |
| `--pixel-heavy-width`                  | Border weight on dialogs and the app header.                |
| `--pixel-shadow-x`, `--pixel-shadow-y` | Hard shadow offset. Set both to `0` for flat panels.        |
| `--pixel-shadow-color`                 | Shadow ink; lower the `30%` mix for a subtler shadow.       |
| `--pixel-font`                         | The pixel face stack.                                       |
| `--pixel-scanline-strength`            | CRT lines on the page background; `0%` disables them.       |

Apply a preset from the webapp:

```bash
pnpm --filter @caly/webapp theme:apply -- --preset <PRESET_CODE>
```

Keep `style`, `baseColor`, `iconLibrary`, and Tailwind settings identical
between `packages/webapp/components.json` and `packages/ui/components.json`.
