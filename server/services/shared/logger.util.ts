// ─── Primitive helpers ────────────────────────────────────────────────────────

function _ts(): string { return new Date().toISOString(); }

function _fmt(source: string, message: string): string {
  return `[${_ts()}] [${source}] ${message}`;
}

export function pushLog(logs: string[], message: string): void {
  logs.push(`[${_ts()}] ${message}`);
}

export function pushError(errors: string[], message: string): void {
  errors.push(`[${_ts()}] ERROR: ${message}`);
}

export function pushWarn(logs: string[], message: string): void {
  logs.push(`[${_ts()}] WARN: ${message}`);
}

export function buildLog(source: string, message: string): string {
  return _fmt(source, message);
}

export function buildError(source: string, message: string): string {
  return `[${_ts()}] [${source}] ERROR: ${message}`;
}

// ─── createLog — 1 or 2 args ──────────────────────────────────────────────────
export function createLog(message: string): string;
export function createLog(source: string, message: string): string;
export function createLog(sourceOrMessage: string, message?: string): string {
  return message !== undefined
    ? _fmt(sourceOrMessage, message)
    : `[${_ts()}] ${sourceOrMessage}`;
}

export function createErrorLog(source: string, message: string): string {
  return buildError(source, message);
}

export function createLogEntry(source: string, message: string): string {
  return buildLog(source, message);
}

// ─── appendLog — 2 or 3 args, immutable, returns new array ───────────────────
export function appendLog(logs: readonly string[], message: string): readonly string[];
export function appendLog(logs: readonly string[], source: string, message: string): readonly string[];
export function appendLog(logs: readonly string[], sourceOrMessage: string, message?: string): readonly string[] {
  const entry = message !== undefined
    ? _fmt(sourceOrMessage, message)
    : `[${_ts()}] ${sourceOrMessage}`;
  return Object.freeze([...logs, entry]);
}

export function appendLogs(logs: readonly string[], messages: readonly string[]): readonly string[] {
  return Object.freeze([...logs, ...messages]);
}

// ─── logStep — always returns immutable updated array ─────────────────────────
export function logStep(logs: readonly string[], step: string): readonly string[] {
  return Object.freeze([...logs, `[${_ts()}] [step] ${step}`]);
}

// ─── logLine — (source, message) → string  OR  (logs[], message) → void ──────
export function logLine(source: string, message: string): string;
export function logLine(logs: string[], message: string): void;
export function logLine(sourceOrLogs: string | string[], message: string): string | void {
  if (typeof sourceOrLogs === 'string') {
    return _fmt(sourceOrLogs, message);
  }
  sourceOrLogs.push(`[${_ts()}] ${message}`);
}

// ─── logEntry ─────────────────────────────────────────────────────────────────
export function logEntry(source: string, message: string): string {
  return buildLog(source, message);
}

// ─── logMessage — 2 or 3 args ─────────────────────────────────────────────────
export function logMessage(source: string, message: string): string;
export function logMessage(source: string, message: string, level: string): string;
export function logMessage(source: string, message: string, level?: string): string {
  const prefix = level ? `[${level}] ` : '';
  return _fmt(source, `${prefix}${message}`);
}

// ─── logEvent — 2 string args → string; (array, string) → readonly string[] ──
export function logEvent(source: string, message: string): string;
export function logEvent(logs: readonly string[], message: string): readonly string[];
export function logEvent(sourceOrLogs: string | readonly string[], message: string): string | readonly string[] {
  if (typeof sourceOrLogs === 'string') {
    return _fmt(sourceOrLogs, message);
  }
  return Object.freeze([...sourceOrLogs, `[${_ts()}] ${message}`]);
}

// ─── formatLogEntry — alias for buildLog ──────────────────────────────────────
export function formatLogEntry(source: string, message: string): string {
  return buildLog(source, message);
}

// ─── logInfo — single-arg info log string ─────────────────────────────────────
export function logInfo(message: string): string {
  return `[${_ts()}] [INFO] ${message}`;
}

// ─── Named convenience re-exports for import { error, info } patterns ─────────
export function info(message: string): string {
  return logInfo(message);
}

// ─── Operation log helpers (for file-writer style usage) ──────────────────────
export interface OperationLog {
  readonly action: string;
  readonly path: string;
  readonly status: string;
  readonly message: string;
  readonly timestamp: string;
}

export function buildOperationLog(params: {
  action: string;
  path: string;
  status: string;
  message: string;
}): OperationLog {
  return Object.freeze({ ...params, timestamp: _ts() });
}

export function formatLogLine(operationLog: OperationLog): string {
  return `[${operationLog.timestamp}] [${operationLog.status}] ${operationLog.action} ${operationLog.path}: ${operationLog.message}`;
}

// ─── logError — 1 arg (message), 2 args (source, message), or (array, message) ─
export function logError(message: string): string;
export function logError(source: string, message: string): string;
export function logError(errors: readonly string[], message: string): readonly string[];
export function logError(
  sourceOrMessageOrErrors: string | readonly string[],
  message?: string,
): string | readonly string[] {
  if (Array.isArray(sourceOrMessageOrErrors)) {
    return Object.freeze([
      ...(sourceOrMessageOrErrors as readonly string[]),
      `[${_ts()}] ERROR: ${message ?? ''}`,
    ]);
  }
  if (message !== undefined) {
    return buildError(sourceOrMessageOrErrors as string, message);
  }
  return `[${_ts()}] ERROR: ${sourceOrMessageOrErrors}`;
}

// Alias for import { error } from logger
export function error(source: string, message: string): string;
export function error(message: string): string;
export function error(sourceOrMessage: string, message?: string): string {
  return message !== undefined
    ? buildError(sourceOrMessage, message)
    : `[${_ts()}] ERROR: ${sourceOrMessage}`;
}

// ─── logScore — flexible: (source, score, label?) or (source, id, details) ───
export function logScore(source: string, score: number, label?: string): string;
export function logScore(source: string, id: string, details: unknown): string;
export function logScore(source: string, scoreOrId: number | string, detailsOrLabel?: unknown): string {
  if (typeof scoreOrId === 'number') {
    const label = typeof detailsOrLabel === 'string' ? ` (${detailsOrLabel})` : '';
    return buildLog(source, `score=${scoreOrId}${label}`);
  }
  const detail = detailsOrLabel !== undefined ? ` ${JSON.stringify(detailsOrLabel)}` : '';
  return buildLog(source, `[${scoreOrId}]${detail}`);
}

// ─── logSelected — 2 or 3 args ────────────────────────────────────────────────
export function logSelected(source: string, selected: string): string;
export function logSelected(source: string, id: string, score: unknown): string;
export function logSelected(source: string, idOrSelected: string, score?: unknown): string {
  const suffix = score !== undefined ? ` score=${score}` : '';
  return buildLog(source, `selected: ${idOrSelected}${suffix}`);
}

// ─── logConflict — 2 or 4 args ────────────────────────────────────────────────
export function logConflict(source: string, conflict: string): string;
export function logConflict(source: string, aId: string, bId: string, conflictType: string): string;
export function logConflict(source: string, conflictOrAId: string, bId?: string, conflictType?: string): string {
  if (bId !== undefined) {
    const typeTag = conflictType ? ` [${conflictType}]` : '';
    return buildLog(source, `conflict between ${conflictOrAId} and ${bId}${typeTag}`);
  }
  return buildLog(source, `conflict: ${conflictOrAId}`);
}

// ─── logDecision — 2 or 3 args ────────────────────────────────────────────────
export function logDecision(source: string, decision: string): string;
export function logDecision(source: string, id: string, detail: string): string;
export function logDecision(source: string, idOrDecision: string, detail?: string): string {
  return detail !== undefined
    ? buildLog(source, `[${idOrDecision}] ${detail}`)
    : buildLog(source, `decision: ${idOrDecision}`);
}

// ─── logBlocked — 2 or 3 args ─────────────────────────────────────────────────
export function logBlocked(source: string, reason: string): string;
export function logBlocked(source: string, id: string, reason: string): string;
export function logBlocked(source: string, idOrReason: string, reason?: string): string {
  return reason !== undefined
    ? buildLog(source, `blocked [${idOrReason}]: ${reason}`)
    : buildLog(source, `blocked: ${idOrReason}`);
}

// ─── formatLog ────────────────────────────────────────────────────────────────
export function formatLog(source: string, message: string): string {
  return buildLog(source, message);
}

// ─── Logger interface + factory ───────────────────────────────────────────────
export interface Logger {
  info:     (message: string, ...args: unknown[]) => string;
  warn:     (message: string, ...args: unknown[]) => string;
  error:    (message: string, ...args: unknown[]) => string;
  debug:    (message: string, ...args: unknown[]) => string;
  log:      (message: string, ...args: unknown[]) => string;
  getLogs:  () => string[];
  entries:  string[];
  history:  string[];
}

export function createLogger(name: string = "agent"): Logger {
  const tag = `[${name}]`;
  const _entries: string[] = [];
  const fmt = (level: string, message: string) =>
    `[${_ts()}] ${tag} ${level}: ${message}`;
  const record = (line: string): string => { _entries.push(line); return line; };
  return {
    info:  (message, ...args) => { const l = fmt("INFO",  message); console.log(l, ...args);   return record(l); },
    warn:  (message, ...args) => { const l = fmt("WARN",  message); console.warn(l, ...args);  return record(l); },
    error: (message, ...args) => { const l = fmt("ERROR", message); console.error(l, ...args); return record(l); },
    debug: (message, ...args) => {
      const l = fmt("DEBUG", message);
      if (process.env.DEBUG) console.debug(l, ...args);
      return record(l);
    },
    log: (message, ...args) => { const l = fmt("INFO", message); console.log(l, ...args); return record(l); },
    getLogs: () => [..._entries],
    get entries() { return _entries; },
    get history() { return _entries; },
  };
}

export function createScopedLogger(scope: string): Logger {
  return createLogger(scope);
}
