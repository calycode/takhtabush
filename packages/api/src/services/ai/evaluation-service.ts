import type { AiEvaluation, CardEvaluation } from '@caly/shared';
import type { AppEnv } from '../../env';
import {
   findCachedEvaluation,
   insertEvaluation,
   mapAiEvaluation,
   type AiEvaluationRow,
} from '../../repositories/ai-evaluations';
import { cardInputHash, strategyInputHash } from './cache';
import { parseClefEvaluation, parseClefStrategy } from './clef';
import { callClef, isAiConfigured } from './gateway-client';
import { cardEvaluationPrompt, CARD_EVALUATION_SCHEMA_VERSION, strategyPrompt } from './schemas';

async function record(
   env: AppEnv,
   input: {
      userId: string;
      subjectType: string;
      subjectId: string;
      purpose: string;
      inputHash: string;
      questionSchema: Record<string, unknown>;
      result: CardEvaluation | null;
      status: 'succeeded' | 'failed' | 'skipped';
      requestId: string | null;
      confidence: number | null;
   },
): Promise<AiEvaluation> {
   return insertEvaluation(env, {
      userId: input.userId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      purpose: input.purpose,
      model: env.CLEF_MODEL,
      gatewayRequestId: input.requestId,
      inputHash: input.inputHash,
      questionSchema: input.questionSchema,
      result: input.result,
      status: input.status,
      confidence: input.confidence,
   });
}

/**
 * Evaluate one card with Clef. Caches by input hash; records every outcome in
 * `ai_evaluations`; never throws (SPEC §8.1, §8.3).
 */
export async function evaluateCard(
   env: AppEnv,
   userId: string,
   card: {
      id: string;
      type: string;
      front: string;
      back?: string | null;
      clozeText?: string | null;
   },
): Promise<AiEvaluation> {
   const inputHash = await cardInputHash(card);
   const cached = await findCachedEvaluation(env, inputHash);
   if (cached) return mapAiEvaluation(cached as AiEvaluationRow);

   const questionSchema = { version: CARD_EVALUATION_SCHEMA_VERSION, purpose: 'card_quality' };

   if (!isAiConfigured(env)) {
      return record(env, {
         userId,
         subjectType: 'card',
         subjectId: card.id,
         purpose: 'card_quality',
         inputHash,
         questionSchema,
         result: null,
         status: 'skipped',
         requestId: null,
         confidence: null,
      });
   }

   const call = await callClef(env, cardEvaluationPrompt(card.front, card.back ?? ''));
   const result = call ? parseClefEvaluation(call.text) : null;

   if (!result) {
      return record(env, {
         userId,
         subjectType: 'card',
         subjectId: card.id,
         purpose: 'card_quality',
         inputHash,
         questionSchema,
         result: null,
         status: call ? 'failed' : 'failed',
         requestId: call?.requestId ?? null,
         confidence: null,
      });
   }

   return record(env, {
      userId,
      subjectType: 'card',
      subjectId: card.id,
      purpose: 'card_quality',
      inputHash,
      questionSchema,
      result,
      status: 'succeeded',
      requestId: call?.requestId ?? null,
      confidence: 1 - result.duplicateLikelihood,
   });
}

export const STRATEGY_OPTIONS = ['review_weak', 'consolidate', 'new_material', 'mixed'] as const;

/** Ask Clef for a session strategy; returns `null` to fall back to the scheduler. */
export async function chooseStrategy(
   env: AppEnv,
   userId: string,
   sessionPreviewId: string,
   signals: Record<string, number>,
): Promise<string | null> {
   if (!isAiConfigured(env)) return null;
   const inputHash = await strategyInputHash(signals);
   const call = await callClef(env, strategyPrompt([...STRATEGY_OPTIONS], signals));
   const strategy = call ? parseClefStrategy(call.text, STRATEGY_OPTIONS) : null;

   await record(env, {
      userId,
      subjectType: 'session',
      subjectId: sessionPreviewId,
      purpose: 'session_strategy',
      inputHash,
      questionSchema: { options: [...STRATEGY_OPTIONS] },
      result: strategy
         ? { clarity: 3, difficulty: 3, duplicateLikelihood: 0, subject: 'other' }
         : null,
      status: strategy ? 'succeeded' : 'failed',
      requestId: call?.requestId ?? null,
      confidence: strategy ? 0.8 : null,
   });

   return strategy;
}
