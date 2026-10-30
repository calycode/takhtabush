import { z } from 'zod';
import { cardTypeSchema } from './cards';
import { idSchema } from './common';
import { sessionStatusSchema, studyModeSchema } from '../domain/modes';

/**
 * MCP Apps study-session widget (SPEC §9.8, [R6]).
 *
 * The widget renders a server-authoritative snapshot and submits reviews through
 * the existing `record_review` tool; it has no independent source of truth.
 */
export const MCP_STUDY_WIDGET_RESOURCE_URI = 'ui://takhtabush/study-session/v1.html';
export const MCP_STUDY_WIDGET_HTTP_PATH = '/mcp-apps/study-session/v1.html';
export const MCP_STUDY_WIDGET_MIME_TYPE = 'text/html;profile=mcp-app';

/**
 * MCP Apps protocol version the widget negotiates in `ui/initialize`. This is
 * the UI extension's version, not the core MCP version (`2025-06-18`): hosts
 * reject the handshake when the two are confused.
 */
export const MCP_APPS_PROTOCOL_VERSION = '2026-01-26';

/** Resource descriptor returned by `resources/list` (MCP Apps, SPEC §9.8). */
export type McpUiResource = {
   uri: string;
   name: string;
   description?: string;
   mimeType: string;
};

/** Resource content returned by `resources/read` (MCP Apps, SPEC §9.8). */
export type McpUiResourceContent = {
   uri: string;
   mimeType: string;
   text: string;
   /**
    * Hosts apply their own CSP to injected HTML, so the widget's network
    * origins must be declared here — an HTTP header is not seen by the host.
    */
   _meta?: {
      ui?: {
         csp?: McpUiResourceCsp;
         prefersBorder?: boolean;
      };
   };
};

/** Which origins an MCP Apps resource may reach (MCP Apps `_meta.ui.csp`). */
export type McpUiResourceCsp = {
   /** `connect-src`: fetch/XHR/WebSocket origins. Omitted means none. */
   connectDomains?: string[];
   /** `img-src`/`media-src`/`script-src`/`style-src`: static asset origins. */
   resourceDomains?: string[];
   /** `frame-src`: nested iframe origins. */
   frameDomains?: string[];
   /** `base-uri`: allowed document base origins. */
   baseUriDomains?: string[];
};

export const MCP_STUDY_WIDGET_RESOURCE: McpUiResource = {
   uri: MCP_STUDY_WIDGET_RESOURCE_URI,
   name: 'Takhtabush study session',
   description: 'Interactive flashcard study session for an existing session.',
   mimeType: MCP_STUDY_WIDGET_MIME_TYPE,
};

/** Compact card content the widget renders — no scheduler internals or row data. */
export const studyWidgetCardSchema = z.object({
   id: idSchema,
   type: cardTypeSchema,
   front: z.string(),
   back: z.string().nullable(),
   clozeText: z.string().nullable(),
   choices: z.array(z.string()).nullable(),
   correctChoice: z.number().int().nullable(),
   imageUrl: z.string().nullable(),
   audioUrl: z.string().nullable(),
});

export type StudyWidgetCard = z.infer<typeof studyWidgetCardSchema>;

/** The authoritative session snapshot rendered by the widget (SPEC §9.8). */
export const studySessionSnapshotSchema = z.object({
   sessionId: idSchema,
   deckId: idSchema,
   deckTitle: z.string(),
   mode: studyModeSchema,
   status: sessionStatusSchema,
   total: z.number().int().nonnegative(),
   reviewed: z.number().int().nonnegative(),
   reviewedCardIds: z.array(idSchema),
   cards: z.array(studyWidgetCardSchema),
   /** Deep link used when the host cannot render the widget (SPEC §9.8 failure table). */
   fallbackStudyPath: z.string(),
});

export type StudySessionSnapshot = z.infer<typeof studySessionSnapshotSchema>;
