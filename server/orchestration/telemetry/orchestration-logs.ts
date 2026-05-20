/**
 * orchestration-logs.ts
 *
 * Structured logging for the orchestration layer.
 * Provides context-rich log entries with runId/projectId/phase tagging.
 */

import type { OrchestrationPhase } from "../core/orchestration-types.ts";

// ── Log levels ────────────────────────────────────────────────────────────────

type LogLevel = "debug" | "info" | "warn" | "error";

// ── Log entry ─────────────────────────────────────────────────────────────────

interface OrchLogEntry {
  ts:        number;
  level:     LogLevel;
  component: string;
  runId?:    string;
  projectId?: number;
  phase?:    OrchestrationPhase;
  message:   string;
  data?:     unknown;
}

// ── In-memory ring buffer (last 500 entries) ──────────────────────────────────

const BUFFER_SIZE   = 500;
const _logBuffer: OrchLogEntry[] = [];

function pushLog(entry: OrchLogEntry): void {
  _logBuffer.push(entry);
  if (_logBuffer.length > BUFFER_SIZE) {
    _logBuffer.shift();
  }
}

// ── Logger factory ────────────────────────────────────────────────────────────

export function createOrchLogger(component: string) {
  function log(
    level: LogLevel,
    message: string,
    opts?: {
      runId?:    string;
      projectId?: number;
      phase?:    OrchestrationPhase;
      data?:     unknown;
    },
  ): void {
    const entry: OrchLogEntry = {
      ts:        Date.now(),
      level,
      component,
      runId:     opts?.runId,
      projectId: opts?.projectId,
      phase:     opts?.phase,
      message,
      data:      opts?.data,
    };

    pushLog(entry);

    const prefix = `[orch:${component}]${opts?.runId ? ` run=${opts.runId.slice(0, 8)}` : ""}${opts?.phase ? ` phase=${opts.phase}` : ""}`;

    switch (level) {
      case "debug": console.debug(`${prefix} ${message}`); break;
      case "info":  console.log  (`${prefix} ${message}`); break;
      case "warn":  console.warn (`${prefix} ${message}`); break;
      case "error": console.error(`${prefix} ${message}`); break;
    }
  }

  return {
    debug: (msg: string, opts?: Parameters<typeof log>[2]) => log("debug", msg, opts),
    info:  (msg: string, opts?: Parameters<typeof log>[2]) => log("info",  msg, opts),
    warn:  (msg: string, opts?: Parameters<typeof log>[2]) => log("warn",  msg, opts),
    error: (msg: string, opts?: Parameters<typeof log>[2]) => log("error", msg, opts),
  };
}

// ── Log query ─────────────────────────────────────────────────────────────────

export function queryLogs(filter?: {
  runId?:     string;
  projectId?: number;
  level?:     LogLevel;
  phase?:     OrchestrationPhase;
  limit?:     number;
}): OrchLogEntry[] {
  let entries = [..._logBuffer];

  if (filter?.runId)     entries = entries.filter(e => e.runId === filter.runId);
  if (filter?.projectId) entries = entries.filter(e => e.projectId === filter.projectId);
  if (filter?.level)     entries = entries.filter(e => e.level === filter.level);
  if (filter?.phase)     entries = entries.filter(e => e.phase === filter.phase);

  if (filter?.limit) entries = entries.slice(-filter.limit);

  return entries;
}

export function clearLogs(): void {
  _logBuffer.length = 0;
}

export function logBufferSize(): number {
  return _logBuffer.length;
}

// ── Default logger ─────────────────────────────────────────────────────────────

export const orchLog = createOrchLogger("orchestration");
