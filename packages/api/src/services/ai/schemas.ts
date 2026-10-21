/** Bump when the Clef prompt or output contract changes (cache invalidation). */
export const CARD_EVALUATION_SCHEMA_VERSION = 'card-eval-v1';

export const CARD_EVALUATION_JSON_SCHEMA = {
   type: 'object',
   additionalProperties: false,
   required: ['clarity', 'difficulty', 'duplicateLikelihood', 'subject'],
   properties: {
      clarity: { type: 'number', minimum: 1, maximum: 5 },
      difficulty: { type: 'number', minimum: 1, maximum: 5 },
      duplicateLikelihood: { type: 'number', minimum: 0, maximum: 1 },
      subject: {
         type: 'string',
         enum: ['language', 'biology', 'history', 'programming', 'mathematics', 'other'],
      },
   },
} as const;

export function cardEvaluationPrompt(front: string, back: string): string {
   return [
      'You are Clef, a decision model. Evaluate the following flashcard.',
      'Return ONLY a JSON object with fields: clarity (1-5), difficulty (1-5),',
      'duplicateLikelihood (0-1), and subject (language|biology|history|programming|mathematics|other).',
      '',
      `Front: ${front}`,
      `Back: ${back}`,
   ].join('\n');
}

export function strategyPrompt(options: string[], signals: Record<string, number>): string {
   return [
      'You are Clef, a decision model. Choose the best study strategy for a learner.',
      `Allowed strategies: ${options.join(', ')}.`,
      'Return ONLY a JSON object like {"strategy":"<one of the allowed>"}.',
      `Signals: ${JSON.stringify(signals)}`,
   ].join('\n');
}
