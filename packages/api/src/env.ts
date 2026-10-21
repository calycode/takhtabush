import type { User } from '@caly/shared';
import type { RequestContextVars } from '@caly/worker-kit';
import type { OAuthHelpers } from '@cloudflare/workers-oauth-provider';

/**
 * Worker bindings and vars for the unified Worker (SPEC §12.2).
 *
 * A single Worker serves the SPA assets, `/api/v1/*`, `/mcp`, and `/media/*`.
 */
export type AppEnv = {
   DB: D1Database;
   MEDIA: R2Bucket;
   AI: Ai;
   ASSETS: Fetcher;
   APP_URL: string;
   SESSION_SECRET: string;
   /** Sender address for magic links. Must be on an onboarded domain in production. */
   EMAIL_FROM: string;
   /** `development` (default) exposes dev magic-link tokens; `production` does not. */
   ENVIRONMENT: string;
   /** Optional single-user bootstrap gate for sign-in (SPEC §3.2). */
   OWNER_INVITE_TOKEN?: string;
   /** The only email allowed to own a fresh deployment (single tenancy). */
   OWNER_EMAIL?: string;
   /** Extra emails allowed to sign in for a small trusted group. */
   ALLOWED_EMAILS?: string;
   /** Enables `POST /auth/setup` while the deployment has no users. */
   SETUP_TOKEN?: string;
   /** Development only: let `/mcp` use the owner without a session or API key. */
   MCP_DEV_NO_AUTH?: string;
   /** Development only: the email to impersonate when MCP auth is disabled. */
   MCP_DEV_USER_EMAIL?: string;
   /** OAuth grants, tokens, and registered clients for the ChatGPT connector. */
   OAUTH_KV?: KVNamespace;
   /** Injected by @cloudflare/workers-oauth-provider for `/oauth/authorize`. */
   OAUTH_PROVIDER?: OAuthHelpers;
   AI_GATEWAY_URL: string;
   AI_GATEWAY_TOKEN?: string;
   CLEF_MODEL: string;
   /** Optional Cloudflare Email binding; when absent magic links log to console. */
   EMAIL?: SendEmail;
};

/** Hono environment for every route in this Worker. */
export type AppBindings = {
   Bindings: AppEnv;
   Variables: RequestContextVars & {
      user?: User;
      sessionId?: string;
      csrfToken?: string;
   };
};
