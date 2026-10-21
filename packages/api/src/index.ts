import { Hono } from 'hono';
import { logger } from 'hono/logger';
import {
   OAuthProvider,
   insufficientScope,
   type OAuthResourceContext,
} from '@cloudflare/workers-oauth-provider';
import { handleMcpRequest, resolveScopes } from '@caly/mcp';
import { MCP_ALL_SCOPES, type McpScope } from '@caly/shared';
import { errorEnvelope } from '@caly/worker-kit';
import type { AppBindings } from './env';
import { sessionMiddleware } from './middleware/auth';
import { corsMiddleware } from './middleware/cors';
import { errorHandler } from './middleware/error-handler';
import { requestContext } from './middleware/request-context';
import { touchApiKey } from './repositories/api-keys';
import { getOwner, getUserByEmail, getUserById, mapUserRow } from './repositories/users';
import type { AppEnv } from './env';
import { registerRoutes } from './routes';
import { API_KEY_PREFIX, resolveApiKey } from './services/api-key-service';
import { runCleanup } from './services/cleanup-service';
import { buildMcpServices } from './services/mcp-services';
import { serveStudyWidget } from './services/mcp-apps-service';
import { readMediaObject } from './services/media-service';

/**
 * The single unified Worker (SPEC §2.1, D1). Route precedence (SPEC §12.3):
 *   1. `/api/v1/*` → Hono API
 *   2. `/mcp`      → MCP Streamable HTTP endpoint
 *   3. `/media/*`  → authenticated R2 read proxy
 *   4. everything else → static SPA assets with SPA fallback
 */
/** Development-only escape hatch for testing MCP tools without a credential. */
function isMcpDevNoAuth(env: AppEnv): boolean {
   return (
      env.ENVIRONMENT === 'development' &&
      (env.MCP_DEV_NO_AUTH === 'true' || env.MCP_DEV_NO_AUTH === '1')
   );
}

export const app = new Hono<AppBindings>();

app.use('*', logger());
app.use('*', requestContext());
app.use('/api/v1/*', corsMiddleware);
app.use('*', sessionMiddleware);

registerRoutes(app);

// 2. MCP endpoint. Authenticated by an API key (`Authorization: Bearer` or
// `x-api-key`) or a browser session cookie.
app.all('/mcp', async (c) => {
   let user = c.get('user');
   let granted: McpScope[] | undefined;
   let suppliedSecret = false;

   if (!user) {
      const secret =
         c.req.header('authorization')?.replace(/^Bearer\s+/i, '') ??
         c.req.header('x-api-key') ??
         undefined;

      if (secret) {
         suppliedSecret = true;
         const key = await resolveApiKey(c.env, secret);
         if (key) {
            const row = await getUserById(c.env, key.userId);
            if (row) {
               user = mapUserRow(row);
               granted = key.scopes;
               void touchApiKey(c.env, key.id).catch(() => undefined);
            }
         }
      }
   }

   // Local development can skip auth, but only when no credential was supplied.
   // A bad API key still fails instead of silently becoming the owner.
   if (!user && !suppliedSecret && isMcpDevNoAuth(c.env)) {
      const email = c.env.MCP_DEV_USER_EMAIL?.trim();
      const row = email ? await getUserByEmail(c.env, email) : await getOwner(c.env);
      if (!row) {
         return c.json(
            errorEnvelope(
               'MCP_DEV_USER_MISSING',
               'MCP_DEV_NO_AUTH is enabled but no owner account exists. Sign in once or set MCP_DEV_USER_EMAIL.',
            ),
            503,
         );
      }
      user = mapUserRow(row);
   }

   if (!user) return c.json(errorEnvelope('UNAUTHORIZED', 'Authentication required'), 401);

   const scopes = resolveScopes(
      c.req.header('x-mcp-scopes') ?? null,
      granted ?? [...MCP_ALL_SCOPES],
   );
   const services = buildMcpServices(c.env, user, c.get('requestId'));
   return handleMcpRequest(c.req.raw, {
      services,
      userId: user.id,
      scopes,
      requestId: c.get('requestId'),
   });
});

// 3. MCP Apps UI resource. Public (the widget is data-free until it calls a
// tool through the host bridge) and served with the MCP Apps MIME type + CSP.
app.get('/mcp-apps/study-session/v1.html', () => serveStudyWidget());

// 4. Authenticated R2 read proxy for media.
app.get('/media/:id', async (c) => {
   const user = c.get('user');
   if (!user) return c.json(errorEnvelope('UNAUTHORIZED', 'Authentication required'), 401);
   return readMediaObject(c.env, c.req.param('id'), user.id);
});

// 4. Static SPA assets. API-looking paths get a JSON 404 instead of index.html.
app.notFound((c) => {
   const path = new URL(c.req.url).pathname;
   if (
      path.startsWith('/api/') ||
      path.startsWith('/mcp') ||
      path.startsWith('/mcp-apps') ||
      path.startsWith('/media/') ||
      path.startsWith('/oauth/') ||
      path.startsWith('/.well-known/')
   ) {
      return c.json(errorEnvelope('NOT_FOUND', 'Not found'), 404);
   }
   return c.env.ASSETS.fetch(c.req.raw);
});

app.onError(errorHandler);

type OAuthProps = { userId: string };

/**
 * The OAuth-protected MCP resource used by ChatGPT. API-key clients continue to
 * use `/mcp`; this endpoint only accepts tokens issued by the provider below.
 */
const mcpOAuthHandler = {
   async fetch(request: Request, env: AppEnv, ctx: ExecutionContext): Promise<Response> {
      const oauthContext = ctx as OAuthResourceContext<OAuthProps>;
      const userId = oauthContext.auth?.userId ?? oauthContext.props?.userId;
      if (!userId) return new Response('Unauthorized', { status: 401 });

      const userRow = await getUserById(env, userId);
      if (!userRow) return new Response('Unauthorized', { status: 401 });

      const granted = new Set(oauthContext.auth.scope);
      const scopes = MCP_ALL_SCOPES.filter((scope) => granted.has(scope));
      if (!scopes.includes('decks:read')) {
         return insufficientScope(oauthContext.auth, ['decks:read']);
      }

      const requestId =
         request.headers.get('cf-ray') ??
         request.headers.get('x-request-id') ??
         crypto.randomUUID();
      const services = buildMcpServices(env, mapUserRow(userRow), requestId);
      return handleMcpRequest(request, { services, userId, scopes, requestId });
   },
};

const oauthProviders = new Map<string, OAuthProvider<AppEnv>>();

/**
 * The provider derives its issuer from the request origin, so the resource
 * metadata must use the same origin. Connect ChatGPT to the canonical host.
 */
function oauthBaseUrl(request: Request): string {
   return new URL(request.url).origin;
}

export function getOAuthProvider(env: AppEnv, request: Request): OAuthProvider<AppEnv> {
   const base = oauthBaseUrl(request);
   const cached = oauthProviders.get(base);
   if (cached) return cached;

   const provider = new OAuthProvider<AppEnv>({
      apiRoute: '/mcp',
      apiHandler: mcpOAuthHandler,
      defaultHandler: {
         fetch: (incoming: Request, bindings: AppEnv, executionCtx: ExecutionContext) =>
            app.fetch(incoming, bindings, executionCtx),
      },
      authorizeEndpoint: '/oauth/authorize',
      tokenEndpoint: '/oauth/token',
      clientRegistrationEndpoint: '/oauth/register',
      scopesSupported: [...MCP_ALL_SCOPES, 'offline_access'],
      // ChatGPT requests the resource's baseline scopes up front. This app is
      // single-tenant, so the owner can grant the full MCP scope set in consent.
      requiredScopes: [...MCP_ALL_SCOPES],
      resourceMetadata: {
         resource: `${base}/mcp`,
         authorization_servers: [base],
         resource_name: 'Takhtabush',
      },
      clientIdMetadataDocumentEnabled: true,
      refreshTokenIdleTTL: 30 * 24 * 60 * 60,
      onError: ({ code, status, internal }) => {
         if (status >= 500) {
            console.error('oauth_error', code, status, internal.category, internal.reason);
         }
      },
   });
   oauthProviders.set(base, provider);
   return provider;
}

/**
 * ChatGPT probes the flat protected-resource metadata URL during discovery.
 * The provider only serves the path-specific document, so without this it
 * falls back to the bare origin as `resource` and the authorize request fails
 * with `invalid_target`.
 */
function flatProtectedResourceMetadata(request: Request): Response {
   const origin = new URL(request.url).origin;
   return Response.json(
      {
         resource: `${origin}/mcp`,
         authorization_servers: [origin],
         scopes_supported: [...MCP_ALL_SCOPES],
         bearer_methods_supported: ['header'],
         resource_name: 'Takhtabush',
      },
      { headers: { 'cache-control': 'no-store' } },
   );
}

/**
 * API keys and browser sessions keep using the Hono `/mcp` route. Only OAuth
 * bearers go through the provider, so the same URL supports both auth models.
 */
function usesApiKeyOrSession(request: Request): boolean {
   const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
   if (bearer?.startsWith(API_KEY_PREFIX)) return true;
   if (bearer) return false;
   if (request.headers.get('x-api-key')) return true;
   return /(?:^|;\s*)sid=/.test(request.headers.get('cookie') ?? '');
}

/**
 * Exported handler: HTTP requests plus the scheduled cleanup job (SPEC §5.4).
 * `wrangler.jsonc` declares the cron trigger.
 */
export default {
   fetch(request: Request, env: AppEnv, ctx: ExecutionContext): Promise<Response> {
      const path = new URL(request.url).pathname;
      if (
         (request.method === 'GET' || request.method === 'HEAD') &&
         (path === '/.well-known/oauth-protected-resource' ||
            path === '/.well-known/oauth-protected-resource/')
      ) {
         return Promise.resolve(flatProtectedResourceMetadata(request));
      }
      if (
         path === '/mcp' &&
         (usesApiKeyOrSession(request) ||
            (isMcpDevNoAuth(env) && !request.headers.get('authorization')))
      ) {
         return Promise.resolve(app.fetch(request, env, ctx));
      }
      return getOAuthProvider(env, request).fetch(request, env, ctx);
   },
   scheduled(_event: ScheduledController, env: AppEnv, ctx: ExecutionContext): void {
      ctx.waitUntil(runCleanup(env).catch((error) => console.error('cleanup_failed', error)));
   },
};
