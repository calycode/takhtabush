import { cardEvaluationSchema, type CardEvaluation } from '@caly/shared';

function clamp(value: unknown, min: number, max: number): number | undefined {
   const num = typeof value === 'number' ? value : Number(value);
   if (!Number.isFinite(num)) return undefined;
   return Math.max(min, Math.min(max, num));
}

/** Extract and validate a card evaluation from a Clef response (SPEC §8.2). */
export function parseClefEvaluation(text: string): CardEvaluation | null {
   let payload: Record<string, unknown>;
   try {
      const match = text.match(/\{[\s\S]*\}/);
      payload = JSON.parse(match ? match[0] : text) as Record<string, unknown>;
   } catch {
      return null;
   }

   const candidate = {
      clarity: clamp(payload.clarity, 1, 5),
      difficulty: clamp(payload.difficulty, 1, 5),
      duplicateLikelihood: clamp(payload.duplicateLikelihood, 0, 1),
      subject: payload.subject,
   };

   const parsed = cardEvaluationSchema.safeParse(candidate);
   return parsed.success ? parsed.data : null;
}

/** Extract a strategy choice from a Clef response, restricted to `allowed`. */
export function parseClefStrategy(text: string, allowed: readonly string[]): string | null {
   try {
      const match = text.match(/\{[\s\S]*\}/);
      const payload = JSON.parse(match ? match[0] : text) as { strategy?: unknown };
      if (typeof payload.strategy === 'string' && allowed.includes(payload.strategy)) {
         return payload.strategy;
      }
      return null;
   } catch {
      return null;
   }
}
