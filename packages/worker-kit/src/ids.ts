/** Prefixes used for every identifier exposed by the API. */
export type IdPrefix =
   | 'usr'
   | 'sess'
   | 'deck'
   | 'card'
   | 'rev'
   | 'fold'
   | 'med'
   | 'stu'
   | 'evt'
   | 'aie'
   | 'mcp'
   | 'tok'
   | 'mag'
   | 'cur';

/** Generate a URL-safe, prefixed identifier, e.g. `deck_1f8a...`. */
export function newId(prefix: IdPrefix): string {
   const bytes = crypto.getRandomValues(new Uint8Array(16));
   const body = base64UrlEncode(bytes);
   return `${prefix}_${body}`;
}

/** Current time as an ISO-8601 string (the storage format for all timestamps). */
export function nowIso(): string {
   return new Date().toISOString();
}

/** Encode bytes as unpadded base64url. */
export function base64UrlEncode(bytes: Uint8Array): string {
   let binary = '';
   for (const byte of bytes) binary += String.fromCharCode(byte);
   return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Decode an unpadded base64url string back to bytes. */
export function base64UrlDecode(value: string): Uint8Array {
   const padded = value.replace(/-/g, '+').replace(/_/g, '/');
   const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='));
   const bytes = new Uint8Array(binary.length);
   for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
   return bytes;
}
