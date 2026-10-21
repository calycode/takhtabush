import { z } from 'zod';
import { idSchema, isoDateSchema } from './common';

/** Clef evaluation output (SPEC §8.2). */
export const cardEvaluationSchema = z.object({
   clarity: z.number().min(1).max(5),
   difficulty: z.number().min(1).max(5),
   duplicateLikelihood: z.number().min(0).max(1),
   subject: z.enum(['language', 'biology', 'history', 'programming', 'mathematics', 'other']),
});

export type CardEvaluation = z.infer<typeof cardEvaluationSchema>;

/** Clef question shapes (SPEC §7.4). */
export const clefQuestionTypeSchema = z.enum(['choice', 'score', 'noul']);
export type ClefQuestionType = z.infer<typeof clefQuestionTypeSchema>;

export const aiPurposeSchema = z.enum([
   'card_quality',
   'session_strategy',
   'subject_classification',
   'duplicate_check',
]);

export type AiPurpose = z.infer<typeof aiPurposeSchema>;

export const aiEvaluationRequestSchema = z.object({
   subjectType: z.enum(['card', 'deck', 'session']),
   subjectId: idSchema,
   purpose: aiPurposeSchema,
});

export type AiEvaluationRequest = z.infer<typeof aiEvaluationRequestSchema>;

export const aiEvaluationStatusSchema = z.enum(['succeeded', 'failed', 'skipped']);
export type AiEvaluationStatus = z.infer<typeof aiEvaluationStatusSchema>;

export const aiEvaluationSchema = z.object({
   id: idSchema,
   userId: idSchema,
   subjectType: z.string(),
   subjectId: idSchema,
   purpose: z.string(),
   model: z.string(),
   gatewayRequestId: z.string().nullable(),
   inputHash: z.string(),
   result: cardEvaluationSchema.nullable(),
   status: aiEvaluationStatusSchema,
   confidence: z.number().nullable(),
   createdAt: isoDateSchema,
});

export type AiEvaluation = z.infer<typeof aiEvaluationSchema>;
