import { describe, expect, it } from 'vitest';
import { MCP_STUDY_WIDGET_MIME_TYPE, MCP_STUDY_WIDGET_RESOURCE_URI } from '@caly/shared';
import { readStudyWidgetResource } from './mcp-apps-service';

describe('MCP Apps study widget resource', () => {
   it('reads the versioned widget as MCP Apps HTML', () => {
      const content = readStudyWidgetResource(MCP_STUDY_WIDGET_RESOURCE_URI);
      expect(content?.mimeType).toBe(MCP_STUDY_WIDGET_MIME_TYPE);
      expect(content?.text).toContain('study session');
   });

   it('returns null for an unknown resource URI', () => {
      expect(readStudyWidgetResource('ui://takhtabush/missing.html')).toBeNull();
   });

   it('declares the Worker origin so host-applied CSP allows card media', () => {
      const content = readStudyWidgetResource(
         MCP_STUDY_WIDGET_RESOURCE_URI,
         'https://takhtabush.example.com',
      );
      expect(content?._meta?.ui?.csp?.resourceDomains).toEqual(['https://takhtabush.example.com']);
      expect(content?._meta?.ui?.csp?.connectDomains).toBeUndefined();
   });
});
