import { transitionState } from "../state.js";
import type { LogLevel, LoggerState } from "../types.js";
import { getEnvString } from "../utils/env.util.js";
import { buildLog } from "../utils/logger.util.js";

const SOURCE = "log-level-manager";

const VALID_LEVELS: readonly LogLevel[] = Object.freeze([
  "info",
  "warn",
  "error",
  "debug",
]);

export interface LogLevelResult {
  readonly nextState: Readonly<LoggerState>;
  readonly logLevel: LogLevel;
}

export function resolveLogLevel(
  state: Readonly<LoggerState>,
  override?: LogLevel,
): Readonly<LogLevelResult> {
  const raw = override ?? getEnvString("LOG_LEVEL", "info");
  const level: LogLevel = VALID_LEVELS.includes(raw as LogLevel)
    ? (raw as LogLevel)
    : "info";

  const log = buildLog(SOURCE, `Log level resolved: ${level}`);

  return {
    nextState: transitionState(state, { logLevel: level, appendLog: log }),
    logLevel: level,
  };
}
