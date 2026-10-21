# Preact + shadcn (Base UI) + Tailwind v4

There are **two independent resolution systems** for the React→Preact aliasing,
and both must be configured.

## Vite

`packages/webapp/vite.config.ts` disables the Preact preset's built-in aliases
(`reactAliasesEnabled: false`) and declares **absolute** aliases:

- `react` → `preact/compat`
- `react-dom` → `preact/compat`
- `react-dom/client` → `preact/compat/client`
- `react/jsx-runtime` → `preact/jsx-runtime`
- `react/jsx-dev-runtime` → `preact/jsx-dev-runtime`

Non-absolute aliases (e.g. `"preact/compat"`) are passed to esbuild and fail.
Regex `find` values keep `react` from prefix-matching `react/jsx-runtime`.

## TypeScript

Both `packages/webapp/tsconfig.json` and `packages/ui/tsconfig.json` set:

```json
{ "jsx": "react-jsx", "jsxImportSource": "preact", "skipLibCheck": true }
```

and mirror `paths` for `react` / `react-dom`. `skipLibCheck: true` is mandatory.

## shadcn

- Run shadcn from `packages/webapp`; primitives are written into `packages/ui`.
- The decisive aliases are `"ui": "@caly/ui/components"` and
  `"utils": "@caly/ui/lib/utils"`.
- `packages/ui/src/lib/preact-compat.ts` strips `ref` before it crosses the
  React→Preact boundary (Base UI types `ref` as a callback taking `never`).

## Compatibility gate (D12)

Verify in the running app that `Dialog`, `DropdownMenu`, `Select`, `Popover`,
and `Tabs` open, close, and position correctly under `preact/compat`. Simple
primitives here use native elements to guarantee behaviour; only Button, Card,
and Dialog use Base UI.
