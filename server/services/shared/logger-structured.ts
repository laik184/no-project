/**
 * server/services/shared/logger-structured.ts
 *
 * Structured domain log helpers — score, selection, conflict, decision, block.
 * Single responsibility: domain-specific log string formatters.
 * No mutation, no Logger interface.
 */

import { buildLog, _ts } from "./logger-primitives.ts";

// ── OperationLog ──────────────────────────────────────────────────────────────

export interface OperationLog {
  readonly action:    string;
  readonly path:      string;
  readonly status:    string;
  readonly message:   string;
  readonly timestamp: string;
}

export function buildOperationLog(params: {
  action: string; path: string; status: string; message: string;
}): OperationLog {
  return Object.freeze({ ...params, timestamp: _ts() });
}

export function formatLogLine(operationLog: OperationLog): string {
  return `[${operationLog.timestamp}] [${operationLog.status}] ${operationLog.action} ${operationLog.path}: ${operationLog.message}`;
}

// ── Domain-specific helpers ───────────────────────────────────────────────────

export function logScore(source: string, score: number, label?: string): string;
export function logScore(source: string, id: string, details: unknown): string;
export function logScore(source: string, scoreOrId: number | string, detailsOrLabel?: unknown): string {
  if (typeof scoreOrId === "number") {
    const label = typeof detailsOrLabel === "string" ? ` (${detailsOrLabel})` : "";
    return buildLog(source, `score=${scoreOrId}${label}`);
  }
  const detail = detailsOrLabel !== undefined ? ` ${JSON.stringify(detailsOrLabel)}` : "";
  return buildLog(source, `[${scoreOrId}]${detail}`);
}

export function logSelected(source: string, selected: string): string;
export function logSelected(source: string, id: string, score: unknown): string;
export function logSelected(source: string, idOrSelected: string, score?: unknown): string {
  return buildLog(source, `selected: ${idOrSelected}${score !== undefined ? ` score=${score}` : ""}`);
}

export function logConflict(source: string, conflict: string): string;
export function logConflict(source: string, aId: string, bId: string, conflictType: string): string;
export function logConflict(source: string, conflictOrAId: string, bId?: string, conflictType?: string): string {
  if (bId !== undefined) {
    return buildLog(source, `conflict between ${conflictOrAId} and ${bId}${conflictType ? ` [${conflictType}]` : ""}`);
  }
  return buildLog(source, `conflict: ${conflictOrAId}`);
}

export function logDecision(source: string, decision: string): string;
export function logDecision(source: string, id: string, detail: string): string;
export function logDecision(source: string, idOrDecision: string, detail?: string): string {
  return detail !== undefined
    ? buildLog(source, `[${idOrDecision}] ${detail}`)
    : buildLog(source, `decision: ${idOrDecision}`);
}

export function logBlocked(source: string, reason: string): string;
export function logBlocked(source: string, id: string, reason: string): string;
export function logBlocked(source: string, idOrReason: string, reason?: string): string {
  return reason !== undefined
    ? buildLog(source, `blocked [${idOrReason}]: ${reason}`)
    : buildLog(source, `blocked: ${idOrReason}`);
}
