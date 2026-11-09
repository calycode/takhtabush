import { AppError } from './errors';

function isLocalHostname(hostname: string): boolean {
   return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

/** Turn user input into a canonical `https://host[:port]` origin. */
export function normalizeOrigin(raw: string): string {
   const trimmed = raw.trim();
   if (!trimmed) {
      throw new AppError('INVALID_URL', 'Enter the URL of your Takhtabush instance.');
   }

   const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
   let url: URL;
   try {
      url = new URL(withScheme);
   } catch {
      throw new AppError('INVALID_URL', 'That does not look like a valid URL.');
   }

   if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new AppError('INVALID_URL', 'Use an http:// or https:// URL.');
   }
   if (url.username || url.password) {
      throw new AppError('INVALID_URL', 'Remove the username and password from the URL.');
   }
   if (url.protocol === 'http:' && !isLocalHostname(url.hostname)) {
      throw new AppError(
         'INSECURE_URL',
         'Use an HTTPS URL. Plain HTTP is only allowed for localhost during development.',
      );
   }

   return url.origin;
}

/**
 * Chrome match patterns ignore ports, so `http://localhost:5173` becomes
 * `http://localhost/*` (which covers every localhost port).
 */
export function permissionPattern(origin: string): string {
   const url = new URL(origin);
   return `${url.protocol}//${url.hostname}/*`;
}
