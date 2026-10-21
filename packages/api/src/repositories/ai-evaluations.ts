import { newId, nowIso } from '@caly/worker-kit';
import type { AiEvaluation, CardEvaluation } from '@caly/shared';
import type { AppEnv } from '../env';

export type AiEvaluationRow = {
   id: string;
   user_id: string;
   subject_type: string;
   subject_id: string;
   purpose: string;
   model: string;
   gateway_request_id: string | null;
   input_hash: string;
   question_schema_json: string;
   result_json: string;
   status: string;
   confidence: number | null;
   created_at: string;
};

export function mapAiEvaluation(row: AiEvaluationRow): AiEvaluation {
   return {
      id: row.id,
      userId: row.user_id,
      subjectType: row.subject_type,
      subjectId: row.subject_id,
      purpose: row.purpose,
      model: row.model,
      gatewayRequestId: row.gateway_request_id,
      inputHash: row.input_hash,
      result: JSON.parse(row.result_json || 'null') as CardEvaluation | null,
      status: (row.status as AiEvaluation['status']) ?? 'succeeded',
      confidence: row.confidence,
      createdAt: row.created_at,
   };
}

/** Cached evaluation for a deterministic (input hash + schema version) query. */
export function findCachedEvaluation(
   env: AppEnv,
   inputHash: string,
): Promise<AiEvaluationRow | null> {
   return env.DB.prepare(
      `SELECT * FROM ai_evaluations WHERE input_hash = ? AND status = 'succeeded' ORDER BY created_at DESC LIMIT 1`,
   )
      .bind(inputHash)
      .first<AiEvaluationRow>();
}

export async function insertEvaluation(
   env: AppEnv,
   input: {
      userId: string;
      subjectType: string;
      subjectId: string;
      purpose: string;
      model: string;
      gatewayRequestId: string | null;
      inputHash: string;
      questionSchema: Record<string, unknown>;
      result: CardEvaluation | null;
      status: string;
      confidence: number | null;
   },
): Promise<AiEvaluation> {
   const id = newId('aie');
   const createdAt = nowIso();
   await env.DB.prepare(
      `INSERT INTO ai_evaluations
         (id, user_id, subject_type, subject_id, purpose, model, gateway_request_id, input_hash,
          question_schema_json, result_json, status, confidence, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
   )
      .bind(
         id,
         input.userId,
         input.subjectType,
         input.subjectId,
         input.purpose,
         input.model,
         input.gatewayRequestId,
         input.inputHash,
         JSON.stringify(input.questionSchema),
         JSON.stringify(input.result),
         input.status,
         input.confidence,
         createdAt,
      )
      .run();
   return mapAiEvaluation({
      id,
      user_id: input.userId,
      subject_type: input.subjectType,
      subject_id: input.subjectId,
      purpose: input.purpose,
      model: input.model,
      gateway_request_id: input.gatewayRequestId,
      input_hash: input.inputHash,
      question_schema_json: JSON.stringify(input.questionSchema),
      result_json: JSON.stringify(input.result),
      status: input.status,
      confidence: input.confidence,
      created_at: createdAt,
   });
}
