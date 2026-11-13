import { fileURLToPath } from 'node:url';

export const E2E_PORT = Number(process.env.E2E_PORT ?? 8788);

/** The suite only ever talks to a local Worker. */
export const BASE_URL = `http://127.0.0.1:${E2E_PORT}`;

/**
 * The suite uses one account: single tenancy admits one owner, so tests are
 * isolated by unique deck/card names rather than by user.
 */
export const E2E_EMAIL = process.env.E2E_EMAIL ?? 'e2e@takhtabush.local';

/** Written by the global setup and loaded by the chromium project. */
export const AUTH_FILE = fileURLToPath(new URL('../auth.json', import.meta.url));

const RUN_ID = Date.now().toString(36);
let counter = 0;

/** A collision-free, human-readable name so failures point at the right test. */
export function uniqueName(prefix: string): string {
   counter += 1;
   return `E2E ${RUN_ID} ${counter} ${prefix}`;
}
