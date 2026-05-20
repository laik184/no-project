import { transitionState } from "../state.js";
import type { LogEntry, LoggerState } from "../types.js";
import { sanitizeMeta } from "../utils/sanitizer.util.js";
import { nowIso } from "../utils/timestamp.util.js";
import { buildError, buildLog } from "../utils/logger.util.js";

const SOURCE = "error-logger";

export interface ErrorInput {
  readonly error: Error;
  readonly requestId?: string;
  readonly meta?: Record<string, unknown>;
}

export interface ErrorLoggerResult {
  readonly nextState: Readonly<LoggerState>;
  readonly entry: Readonly<LogEntry>;
}

export function logError(
  state: Readonly<LoggerState>,
  input: ErrorInput,
  service?: string,
  environment?: string,
): Readonly<ErrorLoggerResult> {
  const sanitized = input.meta ? sanitizeMeta(input.meta) : undefined;

  const entry: Readonly<LogEntry> = Object.freeze({
    timestamp: nowIso(),
    level: "error",
    message: input.error.message,
    requestId: input.requestId,
    service,
    environment,
    ...(sanitized ? { meta: sanitized } : {}),
    error: Object.freeze({
      name: input.error.name,
      message: input.error.message,
      stack: input.error.stack,
    }),
  });

  const log = buildLog(SOURCE, `Error logged: ${input.error.name}: ${input.error.message}`);
  const err = buildError(SOURCE, `${input.error.name}: ${input.error.message}`);

  return {
    nextState: transitionState(state, { appendLog: log, appendError: err }),
    entry,
  };
}
