/**
 * preview-log-repository.ts — Append-only console/network log repository.
 * Imports ONLY from preview-persistence/index.ts.
 */

import { previewCache } from "../../preview-persistence/index.ts";

export type LogLevel = "log" | "info" | "warn" | "error" | "debug";

export interface ConsoleLogEntry {
  readonly projectId: number;
  readonly level:     LogLevel;
  readonly args:      unknown[];
  readonly ts:        number;
}

export interface NetworkLogEntry {
  readonly projectId: number;
  readonly method:    string;
  readonly url:       string;
  readonly status:    number | null;
  readonly type:      string;
  readonly ts:        number;
}

const MAX_LOG_LINES    = 500;
const MAX_NETWORK_REQS = 200;

// ── In-memory stores ──────────────────────────────────────────────────────────

const consoleLogs  = new Map<number, ConsoleLogEntry[]>();
const networkLogs  = new Map<number, NetworkLogEntry[]>();

export const previewLogRepository = {
  // ── Console ──────────────────────────────────────────────────────────────────
  appendConsole(entry: ConsoleLogEntry): void {
    const buf = consoleLogs.get(entry.projectId) ?? [];
    buf.push(entry);
    if (buf.length > MAX_LOG_LINES) buf.shift();
    consoleLogs.set(entry.projectId, buf);
    previewCache.delete(`console:${entry.projectId}`);
  },

  getConsoleLogs(projectId: number, limit = 200): ConsoleLogEntry[] {
    return (consoleLogs.get(projectId) ?? []).slice(-limit);
  },

  clearConsoleLogs(projectId: number): void {
    consoleLogs.delete(projectId);
  },

  // ── Network ──────────────────────────────────────────────────────────────────
  appendNetwork(entry: NetworkLogEntry): void {
    const buf = networkLogs.get(entry.projectId) ?? [];
    buf.push(entry);
    if (buf.length > MAX_NETWORK_REQS) buf.shift();
    networkLogs.set(entry.projectId, buf);
  },

  getNetworkLogs(projectId: number, limit = 100): NetworkLogEntry[] {
    return (networkLogs.get(projectId) ?? []).slice(-limit);
  },

  clearNetworkLogs(projectId: number): void {
    networkLogs.delete(projectId);
  },

  // ── Bulk clear ────────────────────────────────────────────────────────────────
  clearAll(projectId: number): void {
    consoleLogs.delete(projectId);
    networkLogs.delete(projectId);
  },
};
