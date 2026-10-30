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

/** Add the Worker origin so card media can load when the resource is opened directly. */
function studyWidgetCsp(origin?: string): string {
   if (!origin) return STUDY_WIDGET_CSP;
   return STUDY_WIDGET_CSP.replace(
      "img-src 'self' data:",
      `img-src 'self' ${origin} data:`,
   ).replace("media-src 'self'", `media-src 'self' ${origin}`);
}

export function serveStudyWidget(origin?: string): Response {
   return new Response(STUDY_WIDGET_HTML, {
      status: 200,
      headers: {
         'content-type': MCP_STUDY_WIDGET_MIME_TYPE,
         'content-security-policy': studyWidgetCsp(origin),
         'cache-control': 'public, max-age=3600',
         'x-content-type-options': 'nosniff',
      },
   });
}

/**
 * Read the study widget through the MCP `resources/read` contract.
 *
 * The CSP travels in `_meta.ui.csp` because hosts inject this HTML into their
 * own sandboxed iframe and never see the HTTP headers above.
 */
export function readStudyWidgetResource(uri: string, origin?: string): McpUiResourceContent | null {
   if (uri !== MCP_STUDY_WIDGET_RESOURCE_URI) return null;
   return {
      uri,
      mimeType: MCP_STUDY_WIDGET_MIME_TYPE,
      text: STUDY_WIDGET_HTML,
      _meta: {
         ui: {
            csp: { resourceDomains: origin ? [origin] : [] },
         },
      },
   };
}
