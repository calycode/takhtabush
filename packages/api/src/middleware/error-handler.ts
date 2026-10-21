import type { ErrorHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import { ImportParseError } from '@caly/shared';
import { errorEnvelope } from '@caly/worker-kit';
import { AppError } from '../lib/errors';

export const errorHandler: ErrorHandler = (err, c) => {
   if (err instanceof ZodError) {
      return c.json(errorEnvelope('VALIDATION_ERROR', 'Invalid request body', err.issues), 422);
   }

   if (err instanceof ImportParseError) {
      return c.json(errorEnvelope('VALIDATION_ERROR', err.message), 422);
   }

   if (err instanceof AppError) {
      if (err.code === 'RATE_LIMITED') {
         const retryAfter = (err.details as { retryAfterSeconds?: number } | undefined)
            ?.retryAfterSeconds;
         if (retryAfter) c.header('retry-after', String(retryAfter));
      }
      const body = errorEnvelope(err.code, err.message, err.details);
      return c.json(body, err.status as 400);
   }

   if (err instanceof HTTPException) {
      return c.json(errorEnvelope('HTTP_ERROR', err.message), err.status);
   }

   console.error(err);
   return c.json(errorEnvelope('INTERNAL_ERROR', 'Unexpected server error'), 500);
};
