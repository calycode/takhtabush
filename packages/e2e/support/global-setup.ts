import { expect, request } from '@playwright/test';

import { AUTH_FILE, BASE_URL, E2E_EMAIL } from './constants';

/**
 * Development builds return the magic-link token, and the first request on a
 * fresh database claims the owner account. One sign-in per run keeps the suite
 * well below the `10/600s` magic-link rate limit.
 *
 * This is a global setup rather than a setup project so `--grep` (for the
 * `@smoke` tier) still authenticates.
 */
export default async function globalSetup(): Promise<void> {
   const context = await request.newContext({ baseURL: BASE_URL });

   try {
      const requested = await context.post('/api/v1/auth/magic-link', {
         data: { email: E2E_EMAIL },
      });
      expect(requested.status(), await requested.text()).toBe(202);

      const payload = (await requested.json()) as {
         data: { devToken?: string; devCode?: string };
      };
      expect(payload.data.devToken, 'development mode must expose the sign-in token').toBeTruthy();

      const verified = await context.post('/api/v1/auth/verify', {
         data: { token: payload.data.devToken },
      });
      expect(verified.status(), await verified.text()).toBe(200);

      await context.storageState({ path: AUTH_FILE });
   } finally {
      await context.dispose();
   }
}
