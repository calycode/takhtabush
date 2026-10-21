# Agent feedback (Agentation)

Agentation provides click-to-annotate UI feedback for coding agents. It is
development-only and relies on the `react` → `preact/compat` alias.

- Component: `packages/webapp/src/lib/agentation.tsx` (returns `null` outside dev).
- MCP registration:

```bash
claude mcp add agentation -- npx -y agentation-mcp server
```

- The toolbar mounts once at the app root, never inside individual routes.
- Read pending annotations before implementing UI changes; resolve them only
  after verifying the implemented change.
