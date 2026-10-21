/** Normalize an answer for comparison: case, accents, punctuation, and spacing. */
export function normalizeAnswer(value: string): string {
   return value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .replace(/\s+/g, ' ');
}

/** Free-text (typed) answer check. */
export function checkAnswer(expected: string, given: string): boolean {
   const normalized = normalizeAnswer(expected);
   return normalized.length > 0 && normalized === normalizeAnswer(given);
}

/** Extract the hidden tokens from a cloze sentence. */
export function extractClozeTokens(text: string): string[] {
   return [...text.matchAll(/\{\{(.+?)\}\}/g)].map((match) => match[1].trim()).filter(Boolean);
}

/** Replace hidden tokens with a placeholder for display. */
export function maskCloze(text: string): string {
   return text.replace(/\{\{(.+?)\}\}/g, '_____');
}

/** Cloze check: the answer must match every hidden token. */
export function checkCloze(text: string, given: string): boolean {
   const tokens = extractClozeTokens(text);
   if (tokens.length === 0) return false;
   const normalized = normalizeAnswer(given);
   return tokens.every((token) => normalizeAnswer(token) === normalized);
}

/** Map a correctness result to a scheduler response. */
export function gradeFromCorrect(correct: boolean): 'good' | 'again' {
   return correct ? 'good' : 'again';
}

export const FAST_ANSWER_MS = 3000;
export const SLOW_ANSWER_MS = 12000;

export type PerformanceSignals = {
   correct: boolean;
   durationMs: number;
   /** Total attempts on the card; > 1 means at least one retry/mismatch. */
   attempts: number;
   fastMs?: number;
   slowMs?: number;
};

/**
 * Derive a scheduler response from performance so all four grades can arise
 * from auto-graded modes: incorrect -> `again`, retried or slow correct ->
 * `hard`, fast correct -> `easy`, otherwise `good`.
 */
export function gradeFromPerformance({
   correct,
   durationMs,
   attempts,
   fastMs = FAST_ANSWER_MS,
   slowMs = SLOW_ANSWER_MS,
}: PerformanceSignals): 'again' | 'hard' | 'good' | 'easy' {
   if (!correct) return 'again';
   if (attempts > 1) return 'hard';
   if (durationMs <= fastMs) return 'easy';
   if (durationMs >= slowMs) return 'hard';
   return 'good';
}
