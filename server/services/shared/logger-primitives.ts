/**
 * server/services/shared/logger-primitives.ts
 *
 * Primitive log-string helpers — push/append/build utilities.
 * Single responsibility: string construction for log entries.
 * No Logger interface, no structured fields, no factory.
 */

// ── Internal helpers ──────────────────────────────────────────────────────────

export function _ts(): string { return new Date().toISOString(); }

export function _fmt(source: string, message: string): string {
  return `[${_ts()}] [${source}] ${message}`;
}

// ── Mutable array helpers ─────────────────────────────────────────────────────

export function pushLog(logs: string[], message: string): void {
  logs.push(`[${_ts()}] ${message}`);
}

export function pushError(errors: string[], message: string): void {
  errors.push(`[${_ts()}] ERROR: ${message}`);
}

export function pushWarn(logs: string[], message: string): void {
  logs.push(`[${_ts()}] WARN: ${message}`);
}

// ── Build helpers (return strings) ───────────────────────────────────────────

export function buildLog(source: string, message: string): string {
  return _fmt(source, message);
}

export function buildError(source: string, message: string): string {
  return `[${_ts()}] [${source}] ERROR: ${message}`;
}

export function createLog(message: string): string;
export function createLog(source: string, message: string): string;
export function createLog(sourceOrMessage: string, message?: string): string {
  return message !== undefined ? _fmt(sourceOrMessage, message) : `[${_ts()}] ${sourceOrMessage}`;
}

export function createErrorLog(source: string, message: string): string { return buildError(source, message); }
export function createLogEntry(source: string, message: string): string { return buildLog(source, message); }

// ── Immutable array helpers ───────────────────────────────────────────────────

export function appendLog(logs: readonly string[], message: string): readonly string[];
export function appendLog(logs: readonly string[], source: string, message: string): readonly string[];
export function appendLog(logs: readonly string[], sourceOrMessage: string, message?: string): readonly string[] {
  const entry = message !== undefined ? _fmt(sourceOrMessage, message) : `[${_ts()}] ${sourceOrMessage}`;
  return Object.freeze([...logs, entry]);
}

export function appendLogs(logs: readonly string[], messages: readonly string[]): readonly string[] {
  return Object.freeze([...logs, ...messages]);
}

export function logStep(logs: readonly string[], step: string): readonly string[] {
  return Object.freeze([...logs, `[${_ts()}] [step] ${step}`]);
}

export function logLine(source: string, message: string): string;
export function logLine(logs: string[], message: string): void;
export function logLine(sourceOrLogs: string | string[], message: string): string | void {
  if (typeof sourceOrLogs === "string") return _fmt(sourceOrLogs, message);
  sourceOrLogs.push(`[${_ts()}] ${message}`);
}

export function logEntry(source: string, message: string): string { return buildLog(source, message); }

export function logMessage(source: string, message: string): string;
export function logMessage(source: string, message: string, level: string): string;
export function logMessage(source: string, message: string, level?: string): string {
  return _fmt(source, `${level ? `[${level}] ` : ""}${message}`);
}

export function logEvent(source: string, message: string): string;
export function logEvent(logs: readonly string[], message: string): readonly string[];
export function logEvent(sourceOrLogs: string | readonly string[], message: string): string | readonly string[] {
  if (typeof sourceOrLogs === "string") return _fmt(sourceOrLogs, message);
  return Object.freeze([...sourceOrLogs, `[${_ts()}] ${message}`]);
}

export function formatLogEntry(source: string, message: string): string { return buildLog(source, message); }
export function logInfo(message: string): string { return `[${_ts()}] [INFO] ${message}`; }
export function info(message: string): string    { return logInfo(message); }
export function formatLog(source: string, message: string): string { return buildLog(source, message); }

export function logError(message: string): string;
export function logError(source: string, message: string): string;
export function logError(errors: readonly string[], message: string): readonly string[];
export function logError(
  sourceOrMessageOrErrors: string | readonly string[],
  message?: string,
): string | readonly string[] {
  if (Array.isArray(sourceOrMessageOrErrors))
    return Object.freeze([...(sourceOrMessageOrErrors as readonly string[]), `[${_ts()}] ERROR: ${message ?? ""}`]);
  if (message !== undefined) return buildError(sourceOrMessageOrErrors as string, message);
  return `[${_ts()}] ERROR: ${sourceOrMessageOrErrors}`;
}

export function error(source: string, message: string): string;
export function error(message: string): string;
export function error(sourceOrMessage: string, message?: string): string {
  return message !== undefined ? buildError(sourceOrMessage, message) : `[${_ts()}] ERROR: ${sourceOrMessage}`;
}
