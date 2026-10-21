import { base64UrlEncode } from '@caly/worker-kit';

/** A cryptographically random, URL-safe token (used as the raw session/token value). */
export function randomToken(bytes = 32): string {
   return base64UrlEncode(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** Hex-encoded SHA-256 of a UTF-8 string. */
export async function sha256Hex(input: string): Promise<string> {
   const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
   return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Hash a raw token with the deployment secret. Only the hash is ever stored. */
export function hashToken(secret: string, token: string): Promise<string> {
   return sha256Hex(`${secret}:${token}`);
}

/** Constant-time string comparison. */
export function timingSafeEqual(a: string, b: string): boolean {
   if (a.length !== b.length) return false;
   let diff = 0;
   for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
   return diff === 0;
}
