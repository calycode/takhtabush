## Summary

<!-- What changed, and why? One short paragraph is enough. -->

## Related issue

<!-- Link the issue, or write "None". -->

## Type of change

- [ ] Bug fix
- [ ] Feature
- [ ] Refactor (no behavior change)
- [ ] Documentation
- [ ] Database migration
- [ ] Deployment or CI

## How I tested

<!-- Commands and manual steps. Note any behavior that is not covered by tests. -->

- [ ] `pnpm format:check`
- [ ] `pnpm lint`
- [ ] `pnpm check-types`
- [ ] `pnpm test`
- [ ] `pnpm build:all`
- [ ] `pnpm knip`
- [ ] `pnpm db:migrate:check`

## Notes for reviewers

<!-- Migrations, scheduler version bumps, MCP scope changes, or deployment steps. -->

- [ ] I added or updated tests at the seam I changed.
- [ ] I did not include secrets, tokens, or personal data.
- [ ] If the scheduler math changed, I bumped `SCHEDULER_VERSION`.
- [ ] If I changed the MCP widget, I rebuilt `compiled/v1.html.ts`.
