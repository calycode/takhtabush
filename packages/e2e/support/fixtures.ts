import { expect, test as base } from '@playwright/test';

import { ApiClient } from './api';

type Fixtures = {
   /** Seed and inspect data without clicking through the UI. */
   api: ApiClient;
};

export const test = base.extend<Fixtures>({
   // The app bundles everything it needs. A request leaving localhost is a real
   // regression (or an accidental dependency), so fail it early instead of
   // letting it hide in the network panel.
   context: async ({ context }, use) => {
      await context.route('**/*', (route) => {
         const url = new URL(route.request().url());
         const local = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
         if (!local) {
            console.warn(`[e2e] blocked external request: ${url.href}`);
            return route.abort('blockedbyclient');
         }
         return route.continue();
      });
      await use(context);
   },

   api: async ({ context }, use) => {
      const client = new ApiClient(context.request, async () => {
         const cookies = await context.cookies();
         return cookies.find((cookie) => cookie.name === 'csrf')?.value ?? '';
      });
      await use(client);
   },
});

export { expect };
