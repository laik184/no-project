import { initLoggerOrchestrator } from "./orchestrator.js";
import { INITIAL_STATE } from "./state.js";
import type { AgentResult, LoggerInstance, LoggerState } from "./types.js";

let _result: Readonly<AgentResult> | null = null;

export function initLogger(
  state: Readonly<LoggerState> = INITIAL_STATE,
): Readonly<AgentResult> {
  _result = initLoggerOrchestrator(state);
  return _result;
}

export function getLogger(): Readonly<LoggerInstance> {
  if (!_result || !_result.output.success) {
    _result = initLoggerOrchestrator(INITIAL_STATE);
  }
  return _result.output.logger;
}

export function log(
  level: "info" | "warn" | "error" | "debug",
  message: string,
  meta?: Record<string, unknown>,
  requestId?: string,
): void {
  const logger = getLogger();
  if (level === "error") {
    logger.error(message, undefined, meta, requestId);
  } else {
    logger[level](message, meta, requestId);
  }
}

export { INITIAL_STATE, transitionState } from "./state.js";

export type {
  AgentResult,
  FormatType,
  LogEntry,
  LoggerConfig,
  LoggerInstance,
  LoggerOutput,
  LoggerState,
  LogLevel,
  StatePatch,
  TransportConfig,
  TransportType,
} from "./types.js";
