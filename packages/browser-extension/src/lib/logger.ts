const PREFIX = '[Takhtabush Extension]';

/**
 * Small console wrapper so every extension log can be filtered with one
 * prefix. Never pass connection tokens or API keys to these helpers.
 */
export const log = {
   info(message: string, ...data: unknown[]): void {
      console.info(PREFIX, message, ...data);
   },
   warn(message: string, ...data: unknown[]): void {
      console.warn(PREFIX, message, ...data);
   },
   error(message: string, ...data: unknown[]): void {
      console.error(PREFIX, message, ...data);
   },
   debug(message: string, ...data: unknown[]): void {
      console.debug(PREFIX, message, ...data);
   },
};
