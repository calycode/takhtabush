import { withTimeout } from '@caly/worker-kit';
import type { AppEnv } from '../../env';

export type ClefCall = { text: string; requestId: string | null };

export const CLEF_TIMEOUT_MS = 5000;

/** True when any Clef backend (AI Gateway HTTP or Workers AI) is configured. */
export function isAiConfigured(env: AppEnv): boolean {
   return Boolean(env.AI_GATEWAY_URL) || Boolean(env.AI);
}

/**
 * Call Clef. Prefers the AI Gateway HTTP endpoint when configured, otherwise
 * falls back to the Workers AI binding. Returns `null` on any failure so
 * callers degrade gracefully (SPEC §8.3).
 */
export async function callClef(env: AppEnv, prompt: string): Promise<ClefCall | null> {
   try {
      if (env.AI_GATEWAY_URL && env.AI_GATEWAY_TOKEN) {
         const response = await withTimeout(
            fetch(`${env.AI_GATEWAY_URL}/chat/completions`, {
               method: 'POST',
               headers: {
                  'content-type': 'application/json',
                  authorization: `Bearer ${env.AI_GATEWAY_TOKEN}`,
               },
               body: JSON.stringify({
                  model: env.CLEF_MODEL,
                  messages: [{ role: 'user', content: prompt }],
                  response_format: { type: 'json_object' },
               }),
            }),
            CLEF_TIMEOUT_MS,
         );
         if (!response.ok) return null;
         const data = (await response.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
         };
         const text = data.choices?.[0]?.message?.content;
         if (typeof text !== 'string') return null;
         return { text, requestId: response.headers.get('cf-aig-request-id') ?? null };
      }

      if (env.AI) {
         const output = await withTimeout(env.AI.run(env.CLEF_MODEL, { prompt }), CLEF_TIMEOUT_MS);
         const text = typeof output === 'string' ? output : JSON.stringify(output);
         return { text, requestId: null };
      }

      return null;
   } catch {
      return null;
   }
}
