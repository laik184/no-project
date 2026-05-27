/**
 * server/tools/registry/tool-security.ts
 *
 * Audit log for tool executions.
 * Tracks every dispatch attempt (success or failure) for observability.
 */

import type { ToolCategory } from './tool-types.ts';

export interface AuditLogEntry {
  ts:        string;
  toolName:  string;
  category:  ToolCategory;
  runId:     string;
  ok:        boolean;
  durationMs: number;
  errorCode?: string;
}

const MAX_ENTRIES = 500;
const auditLog: AuditLogEntry[] = [];

export function recordAudit(entry: AuditLogEntry): void {
  auditLog.push(entry);
  if (auditLog.length > MAX_ENTRIES) auditLog.shift();
}

export function getAuditLog(limit = 50): readonly AuditLogEntry[] {
  return Object.freeze(auditLog.slice(-Math.min(limit, MAX_ENTRIES)));
}

export function clearAuditLog(): void {
  auditLog.length = 0;
}

export function auditStats(): { total: number; failures: number; successes: number } {
  const failures  = auditLog.filter(e => !e.ok).length;
  return { total: auditLog.length, failures, successes: auditLog.length - failures };
}
