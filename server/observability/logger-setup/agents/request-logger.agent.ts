import { transitionState } from "../state.js";
import type { LogEntry, LogLevel, LoggerState } from "../types.js";
import { sanitizeMeta } from "../utils/sanitizer.util.js";
import { nowIso } from "../utils/timestamp.util.js";
import { buildLog } from "../utils/logger.util.js";

const SOURCE = "request-logger";

export interface RequestInput {
  readonly method: string;
  readonly url: string;
  readonly statusCode?: number;
  readonly durationMs?: number;
  readonly requestId?: string;
  readonly meta?: Record<string, unknown>;
}

export interface RequestLoggerResult {
  readonly nextState: Readonly<LoggerState>;
  readonly entry: Readonly<LogEntry>;
}

export function logRequest(
  state: Readonly<LoggerState>,
  input: RequestInput,
  service?: string,
  environment?: string,
): Readonly<RequestLoggerResult> {
  const statusCode = input.statusCode ?? 200;
  const level: LogLevel = statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";
  const duration = input.durationMs != null ? `${input.durationMs}ms` : undefined;

  const messageParts = [input.method, input.url, String(statusCode)];
  if (duration) messageParts.push(duration);

  const sanitized = input.meta ? sanitizeMeta(input.meta) : undefined;

  const entry: Readonly<LogEntry> = Object.freeze({
    timestamp: nowIso(),
    level,
    message: messageParts.join(" "),
    requestId: input.requestId,
    service,
    environment,
    ...(sanitized ? { meta: sanitized } : {}),
  });

  const log = buildLog(SOURCE, `Request logged: ${input.method} ${input.url} ${statusCode}`);

  return {
    nextState: transitionState(state, { appendLog: log }),
    entry,
  };
}
