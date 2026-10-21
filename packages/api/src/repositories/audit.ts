import { newId, nowIso } from '@caly/worker-kit';
import type { McpAuditEvent } from '@caly/shared';
import type { AppEnv } from '../env';

export async function insertAuditEvent(env: AppEnv, event: McpAuditEvent): Promise<void> {
   await env.DB.prepare(
      `INSERT INTO mcp_audit_events
         (id, user_id, tool_name, action, input_summary_json, affected_ids_json, request_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
   )
      .bind(
         newId('mcp'),
         event.userId,
         event.toolName,
         event.action,
         JSON.stringify(event.inputSummary),
         JSON.stringify(event.affectedIds),
         event.requestId,
         event.createdAt || nowIso(),
      )
      .run();
}
