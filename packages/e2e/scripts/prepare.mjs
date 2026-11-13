import { freePort } from './port.mjs';

// Runs before `playwright test` so a stale local Worker cannot trip the
// webServer "already used" check.
await freePort();
