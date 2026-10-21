import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
   resolve: {
      alias: {
         // Node cannot resolve the Workers runtime module when importing the
         // OAuth provider in unit tests; a minimal stub is enough for instanceof
         // checks because tests never instantiate WorkerEntrypoint handlers.
         'cloudflare:workers': fileURLToPath(
            new URL('./src/test/cloudflare-workers.ts', import.meta.url),
         ),
      },
   },
   test: {
      environment: 'node',
      passWithNoTests: true,
      server: {
         deps: {
            inline: ['@cloudflare/workers-oauth-provider'],
         },
      },
   },
});
