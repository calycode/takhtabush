import {
   MCP_STUDY_WIDGET_MIME_TYPE,
   MCP_STUDY_WIDGET_RESOURCE_URI,
   type McpUiResourceContent,
} from '@caly/shared';
import { STUDY_WIDGET_HTML } from '@caly/study-widget/compiled';

/**
 * Serve the MCP Apps study-session widget resource (SPEC §9.8, [R6]).
 *
 * The resource is self-contained (inline script/style), so it renders without
 * extra requests. CSP locks it down: no network, no external origins; only the
 * host may frame it. Every write it performs goes back through the MCP host
 * bridge to `record_review`, which is server-authoritative and append-only.
 */
const STUDY_WIDGET_CSP = [
   "default-src 'none'",
   "script-src 'unsafe-inline'",
   "style-src 'unsafe-inline'",
   "img-src 'self' data:",
   "media-src 'self'",
   "connect-src 'none'",
   "base-uri 'none'",
   "form-action 'none'",
   'frame-ancestors *',
].join('; ');

export function serveStudyWidget(): Response {
   return new Response(STUDY_WIDGET_HTML, {
      status: 200,
      headers: {
         'content-type': MCP_STUDY_WIDGET_MIME_TYPE,
         'content-security-policy': STUDY_WIDGET_CSP,
         'cache-control': 'public, max-age=3600',
         'x-content-type-options': 'nosniff',
      },
   });
}

/** Read the study widget through the MCP `resources/read` contract. */
export function readStudyWidgetResource(uri: string): McpUiResourceContent | null {
   if (uri !== MCP_STUDY_WIDGET_RESOURCE_URI) return null;
   return {
      uri,
      mimeType: MCP_STUDY_WIDGET_MIME_TYPE,
      text: STUDY_WIDGET_HTML,
   };
}
