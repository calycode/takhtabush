import { cors } from 'hono/cors';
import type { MiddlewareHandler } from 'hono';

/** Variables attached to the Hono request context by {@link requestContext}. */
export type RequestContextVars = {
   requestId: string;
   startedAt: number;
};

/** Adds a correlation id and start time to the request context. */
export function requestContext(): MiddlewareHandler {
   return async (c, next) => {
      const requestId =
         c.req.header('cf-ray') ?? c.req.header('x-request-id') ?? crypto.randomUUID();
      c.set('requestId', requestId);
      c.set('startedAt', Date.now());
      c.header('x-request-id', requestId);
      await next();
   };
}

/** Binding-agnostic CORS middleware factory. */
export function createCors(origin: string | string[] = '*'): MiddlewareHandler {
   return cors({
      origin,
      credentials: true,
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'x-csrf-token', 'x-request-id'],
      exposeHeaders: ['x-request-id'],
      maxAge: 86400,
   });
}

/** Reject if a promise does not settle within `ms` milliseconds. */
export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
   let timer: ReturnType<typeof setTimeout> | undefined;
   try {
      return await Promise.race([
         promise,
         new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
         }),
      ]);
   } finally {
      if (timer) clearTimeout(timer);
   }
}
