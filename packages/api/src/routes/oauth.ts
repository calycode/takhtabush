import { Hono, type Context } from 'hono';
import {
   AuthorizationError,
   CimdFetchError,
   type ConsentDescription,
} from '@cloudflare/workers-oauth-provider';
import { type AppBindings, type AppEnv } from '../env';

const MIN_CONSENT_SECRET_LENGTH = 32;

function escapeHtml(value: string): string {
   return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

const SCOPE_LABELS: Record<string, string> = {
   'decks:read': 'Read your decks and cards',
   'stats:read': 'Read your study statistics',
   'decks:write': 'Create, edit, and delete decks and cards',
   'study:write': 'Start study sessions and record reviews',
   'media:write': 'Upload and manage images and audio',
   'study:render': 'Render interactive study sessions',
   offline_access: 'Stay connected with refresh tokens',
};

const PAGE_STYLES = `
:root {
  color-scheme: light dark;
  --bg: #f4f6f5;
  --card: #ffffff;
  --fg: #111827;
  --muted: #6b7280;
  --border: #e5e7eb;
  --soft: #f9fafb;
  --primary: #15803d;
  --primary-hover: #166534;
  --primary-fg: #ffffff;
  --warning-bg: #fffbeb;
  --warning-border: #fde68a;
  --warning-fg: #92400e;
  --danger: #b91c1c;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0b0f14;
    --card: #111820;
    --fg: #e5e7eb;
    --muted: #94a3b8;
    --border: #1f2937;
    --soft: #0f1720;
    --primary: #22c55e;
    --primary-hover: #16a34a;
    --primary-fg: #052e16;
    --warning-bg: #2a210b;
    --warning-border: #4d3b0f;
    --warning-fg: #fde68a;
    --danger: #fca5a5;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--bg);
  color: var(--fg);
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;
}
.card {
  width: 100%;
  max-width: 480px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: 0 24px 60px -28px rgba(15, 23, 42, 0.35);
  overflow: hidden;
}
.card-header { padding: 24px 24px 0; }
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.01em;
}
.brand-mark {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  background: var(--primary);
  color: var(--primary-fg);
  font-size: 14px;
  font-weight: 800;
}
h1 {
  margin: 18px 0 8px;
  font-size: 22px;
  line-height: 1.25;
  letter-spacing: -0.02em;
}
.subtitle {
  margin: 0;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.55;
}
.card-body { padding: 20px 24px 24px; }
.meta {
  display: grid;
  gap: 10px;
  padding: 14px 16px;
  background: var(--soft);
  border: 1px solid var(--border);
  border-radius: 12px;
}
.meta-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  font-size: 13px;
}
.meta-label { color: var(--muted); }
.meta-value { font-weight: 600; text-align: right; overflow-wrap: anywhere; }
.meta-sub { display: block; color: var(--muted); font-weight: 400; font-size: 12px; }
.warning {
  margin-top: 14px;
  padding: 12px 14px;
  border: 1px solid var(--warning-border);
  border-radius: 12px;
  background: var(--warning-bg);
  color: var(--warning-fg);
  font-size: 13px;
  line-height: 1.5;
}
.section-title {
  margin: 20px 0 0;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}
.scopes {
  list-style: none;
  margin: 10px 0 0;
  padding: 0;
  display: grid;
  gap: 10px;
}
.scope { display: flex; align-items: flex-start; gap: 10px; }
.scope-check {
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  margin-top: 1px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--primary);
  color: var(--primary-fg);
  font-size: 11px;
  font-weight: 800;
}
.scope-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.scope-name { font-size: 14px; font-weight: 500; line-height: 1.4; }
.scope-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  color: var(--muted);
}
.actions {
  display: flex;
  gap: 10px;
  margin-top: 24px;
}
.btn {
  flex: 1;
  height: 42px;
  border-radius: 10px;
  border: 1px solid transparent;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, transform 0.15s;
}
.btn:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
.btn:active { transform: translateY(1px); }
.btn-primary { background: var(--primary); color: var(--primary-fg); }
.btn-primary:hover { background: var(--primary-hover); }
.btn-secondary { background: transparent; border-color: var(--border); color: var(--fg); }
.btn-secondary:hover { background: var(--soft); }
.footer {
  padding: 0 24px 24px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
}
.error { color: var(--danger); font-size: 14px; line-height: 1.55; }
@media (max-width: 480px) {
  body { padding: 12px; }
  .card-header { padding: 20px 20px 0; }
  .card-body { padding: 16px 20px 20px; }
  .footer { padding: 0 20px 20px; }
  .actions { flex-direction: column-reverse; }
}
`;

function scopeLabel(scope: string): string {
   return SCOPE_LABELS[scope] ?? 'Access your account';
}

function pageShell(title: string, body: string): string {
   return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>${PAGE_STYLES}</style>
</head>
<body>${body}</body>
</html>`;
}

function consentPage(details: ConsentDescription, handle: string, email: string): string {
   const client = escapeHtml(details.clientName || 'This app');
   const domain = details.clientDomain ? escapeHtml(details.clientDomain) : '';
   const loopback = details.redirectIsLoopback
      ? '<div class="warning" role="note"><strong>This sends access to an app on your computer.</strong> Continue only if you just started signing in from it.</div>'
      : '';
   const scopes = details.scope.length
      ? details.scope
           .map(
              (scope) => `<li class="scope">
<span class="scope-check" aria-hidden="true">✓</span>
<span class="scope-text"><span class="scope-name">${escapeHtml(scopeLabel(scope))}</span><span class="scope-code">${escapeHtml(scope)}</span></span>
</li>`,
           )
           .join('')
      : '<li class="scope"><span class="scope-check" aria-hidden="true">✓</span><span class="scope-text"><span class="scope-name">Basic access</span></span></li>';

   return pageShell(
      `Authorize ${client} · Takhtabush`,
      `<main class="card">
<div class="card-header">
<div class="brand"><span class="brand-mark" aria-hidden="true">T</span><span>Takhtabush</span></div>
<h1>Allow ${client} to access your flashcards?</h1>
<p class="subtitle">This app is requesting permission to read and update your study data on your behalf.</p>
</div>
<div class="card-body">
<div class="meta">
<div class="meta-row"><span class="meta-label">Signed in as</span><span class="meta-value">${escapeHtml(email)}</span></div>
<div class="meta-row"><span class="meta-label">Requested by</span><span class="meta-value">${client}${domain ? `<span class="meta-sub">${domain}</span>` : ''}</span></div>
<div class="meta-row"><span class="meta-label">Access sent to</span><span class="meta-value">${escapeHtml(details.redirectHost)}</span></div>
</div>
${loopback}
<p class="section-title">This grants</p>
<ul class="scopes">${scopes}</ul>
<form method="post">
<input type="hidden" name="handle" value="${escapeHtml(handle)}">
<div class="actions">
<button class="btn btn-secondary" name="decision" value="deny" type="submit">Cancel</button>
<button class="btn btn-primary" name="decision" value="approve" type="submit">Allow access</button>
</div>
</form>
</div>
<div class="footer">You can disconnect this app from your ChatGPT settings at any time.</div>
</main>`,
   );
}

function errorPage(message: string): string {
   return pageShell(
      'Authorization failed · Takhtabush',
      `<main class="card">
<div class="card-header">
<div class="brand"><span class="brand-mark" aria-hidden="true">T</span><span>Takhtabush</span></div>
<h1>Authorization failed</h1>
<p class="error">${escapeHtml(message)}</p>
</div>
<div class="card-body"><p class="subtitle">Close this window and start again from your MCP client.</p></div>
</main>`,
   );
}

function htmlResponse(body: string, status: number, headers?: Headers): Response {
   const responseHeaders = new Headers(headers);
   responseHeaders.set('content-type', 'text/html; charset=utf-8');
   responseHeaders.set('cache-control', 'no-store');
   return new Response(body, { status, headers: responseHeaders });
}

function redirectResponse(location: string, headers?: Headers): Response {
   const responseHeaders = new Headers(headers);
   responseHeaders.set('location', location);
   return new Response(null, { status: 302, headers: responseHeaders });
}

function loginRedirect(c: Context<AppBindings>): Response {
   const url = new URL(c.req.url);
   const next = `${url.pathname}${url.search}`;
   return c.redirect(`/login?next=${encodeURIComponent(next)}`);
}

function consentSecret(env: AppEnv): string | null {
   if (env.SESSION_SECRET.length < MIN_CONSENT_SECRET_LENGTH) return null;
   return env.SESSION_SECRET;
}

function authorizationFailure(cause: unknown): Response {
   if (cause instanceof AuthorizationError) {
      if (cause.redirectTo) return redirectResponse(cause.redirectTo);
      return htmlResponse(errorPage(cause.description), 400);
   }
   if (cause instanceof CimdFetchError) {
      return htmlResponse(errorPage('This app could not be verified.'), 400);
   }
   throw cause;
}

export const oauthRoutes = new Hono<AppBindings>()
   .get('/authorize', async (c) => {
      const oauth = c.env.OAUTH_PROVIDER;
      if (!oauth) return c.text('OAuth is not configured on this deployment.', 503);

      const user = c.get('user');
      if (!user) return loginRedirect(c);

      const secret = consentSecret(c.env);
      if (!secret) {
         return c.text('OAuth consent requires a SESSION_SECRET of at least 32 characters.', 503);
      }

      try {
         const request = await oauth.parseAuthRequest(c.req.raw);
         const remember = { secret, subject: user.id };

         if (await oauth.isConsentRemembered(c.req.raw, request, remember)) {
            const { redirectTo } = await oauth.completeAuthorization({
               request,
               userId: user.id,
               metadata: { email: user.email },
               scope: request.scope,
               props: { userId: user.id },
            });
            return redirectResponse(redirectTo);
         }

         const details = await oauth.describeConsent(request);
         const consent = await oauth.beginConsent(request);
         return htmlResponse(
            consentPage(details, consent.handle, user.email),
            200,
            consent.headers,
         );
      } catch (cause) {
         return authorizationFailure(cause);
      }
   })
   .post('/authorize', async (c) => {
      const oauth = c.env.OAUTH_PROVIDER;
      if (!oauth) return c.text('OAuth is not configured on this deployment.', 503);

      const user = c.get('user');
      if (!user) return loginRedirect(c);

      const secret = consentSecret(c.env);
      if (!secret) {
         return c.text('OAuth consent requires a SESSION_SECRET of at least 32 characters.', 503);
      }

      const form = await c.req.formData();
      const handle = form.get('handle');
      if (typeof handle !== 'string' || handle.length === 0) {
         return htmlResponse(
            errorPage('This authorization request expired. Start again from your MCP client.'),
            400,
         );
      }

      try {
         if (form.get('decision') !== 'approve') {
            const denied = await oauth.denyConsent(c.req.raw, handle);
            return redirectResponse(denied.redirectTo, denied.headers);
         }

         const approved = await oauth.approveConsent(c.req.raw, handle, {
            remember: { secret, subject: user.id },
         });
         const { redirectTo } = await oauth.completeAuthorization({
            request: approved.request,
            userId: user.id,
            metadata: { email: user.email },
            scope: approved.request.scope,
            props: { userId: user.id },
         });
         return redirectResponse(redirectTo, approved.headers);
      } catch (cause) {
         return authorizationFailure(cause);
      }
   });
