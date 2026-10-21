/**
 * Minimal stand-in for the Workers runtime module. Vitest runs in Node, while
 * `@cloudflare/workers-oauth-provider` imports `WorkerEntrypoint` to detect
 * class-shaped handlers. The app uses exported-handler objects, so an empty
 * base class is sufficient for unit tests.
 */
type CloudflareGlobal = { compatibilityFlags?: Record<string, boolean> };
const globalWithCloudflare = globalThis as typeof globalThis & {
   Cloudflare?: CloudflareGlobal;
};
globalWithCloudflare.Cloudflare ??= {
   compatibilityFlags: { global_fetch_strictly_public: true },
};

export class WorkerEntrypoint {}
