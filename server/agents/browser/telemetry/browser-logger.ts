/**
 * server/agents/browser/telemetry/browser-logger.ts
 *
 * Structured logging for the browser agent.
 * Exports both the `browserLogger` singleton (for tools layer)
 * and named helper functions (for orchestration layer).
 */

import type { ActionEntry } from '../types/reporting.types.ts';

// ── In-memory action log per run ──────────────────────────────────────────────

const _actionLog = new Map<string, ActionEntry[]>();
const MAX_ENTRIES = 200;

function pushEntry(runId: string, entry: ActionEntry): void {
  const log = _actionLog.get(runId) ?? [];
  if (log.length >= MAX_ENTRIES) log.shift();
  log.push(entry);
  _actionLog.set(runId, log);
}

function fmt(level: string, runId: string, msg: string, meta?: unknown): string {
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  return `[browser][${level}] runId=${runId} ${msg}${metaStr}`;
}

// ── Singleton object (used by tools layer) ────────────────────────────────────

export const browserLogger = {
  info(runId: string, message: string, meta?: unknown): void {
    console.log(fmt('INFO', runId, message, meta));
    pushEntry(runId, { action: 'log.info', tool: 'browser_log', ok: true, durationMs: 0, ts: new Date().toISOString() });
  },

  warn(runId: string, message: string, meta?: unknown): void {
    console.warn(fmt('WARN', runId, message, meta));
    pushEntry(runId, { action: 'log.warn', tool: 'browser_log', ok: true, durationMs: 0, ts: new Date().toISOString() });
  },

  error(runId: string, message: string, meta?: unknown): void {
    console.error(fmt('ERR', runId, message, meta));
    pushEntry(runId, { action: 'log.error', tool: 'browser_log', ok: false, durationMs: 0, ts: new Date().toISOString() });
  },

  debug(runId: string, message: string, meta?: unknown): void {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(fmt('DBG', runId, message, meta));
    }
  },
};

// ── Named helpers (used by orchestration layer) ───────────────────────────────

export function logSessionStart(runId: string, sessionId: string, url: string): void {
  browserLogger.info(runId, `Session started | sessionId=${sessionId} url=${url.slice(0, 80)}`);
  pushEntry(runId, { action: 'session.start', tool: 'browser_launch', ok: true, durationMs: 0, ts: new Date().toISOString() });
}

export function logSessionEnd(runId: string, sessionId: string, ok: boolean, durationMs: number): void {
  const tag = ok ? '✓' : '✗';
  browserLogger.info(runId, `Session ${tag} | sessionId=${sessionId} duration=${durationMs}ms`);
  pushEntry(runId, { action: 'session.end', tool: 'browser_close', ok, durationMs, ts: new Date().toISOString() });
}

export function logStep(runId: string, tool: string, ok: boolean, durationMs: number, error?: string): void {
  if (!ok) {
    browserLogger.warn(runId, `Step failed | tool=${tool} error=${(error ?? 'unknown').slice(0, 120)}`);
  }
  pushEntry(runId, { action: `step.${ok ? 'ok' : 'fail'}`, tool, ok, durationMs, ts: new Date().toISOString(), error });
}

export function logRetry(runId: string, tool: string, attempt: number, reason: string): void {
  browserLogger.warn(runId, `Retry | tool=${tool} attempt=${attempt} reason=${reason.slice(0, 80)}`);
}

export function logValidation(runId: string, ok: boolean, summary: string, durationMs: number): void {
  browserLogger.info(runId, `Validation ${ok ? '✓' : '✗'} | ${summary}`);
  pushEntry(runId, { action: 'validation', tool: 'browser_validate_ui', ok, durationMs, ts: new Date().toISOString() });
}

// ── Log retrieval ─────────────────────────────────────────────────────────────

export function getActionLog(runId: string): ActionEntry[] {
  return _actionLog.get(runId) ?? [];
}

export function clearActionLog(runId: string): void {
  _actionLog.delete(runId);
}
