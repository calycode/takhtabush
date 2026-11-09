/** Failure that carries a stable code across the extension message boundary. */
export class AppError extends Error {
   constructor(
      readonly code: string,
      message: string,
   ) {
      super(message);
      this.name = 'AppError';
   }
}
