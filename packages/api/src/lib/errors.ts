/** An error with a stable machine code and HTTP status (SPEC §6.1). */
export class AppError extends Error {
   constructor(
      readonly code: string,
      message: string,
      readonly status = 400,
      readonly details?: unknown,
   ) {
      super(message);
      this.name = 'AppError';
   }
}

export const notFound = (message = 'Resource not found') => new AppError('NOT_FOUND', message, 404);
export const unauthorized = (message = 'Authentication required') =>
   new AppError('UNAUTHORIZED', message, 401);
export const forbidden = (message = 'Not allowed') => new AppError('FORBIDDEN', message, 403);
export const conflict = (message = 'Conflict') => new AppError('CONFLICT', message, 409);
