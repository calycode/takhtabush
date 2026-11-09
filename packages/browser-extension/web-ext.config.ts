import { resolve } from 'node:path';
import { defineWebExtConfig } from 'wxt';

export default defineWebExtConfig({
   // Open Quizlet on `pnpm dev:extension`.
   startUrls: ['https://quizlet.com/'],
   // Keep the Quizlet login between dev sessions so the content script is easy
   // to test against a real set page.
   chromiumProfile: resolve('.wxt/chrome-data'),
   keepProfileChanges: true,
});
