import { transitionState } from "../state.js";
import type { FormatType, LoggerConfig, LoggerState, LogLevel, TransportConfig } from "../types.js";
import { getEnvString } from "../utils/env.util.js";
import { buildLog } from "../utils/logger.util.js";

const SOURCE = "logger-config";

const VALID_FORMATS: readonly FormatType[] = Object.freeze(["json", "pretty"]);

export interface LoggerConfigResult {
  readonly nextState: Readonly<LoggerState>;
  readonly config: Readonly<LoggerConfig>;
}

export function buildLoggerConfig(
  state: Readonly<LoggerState>,
  level: LogLevel,
  transports: readonly TransportConfig[],
): Readonly<LoggerConfigResult> {
  const rawFormat = getEnvString("LOG_FORMAT", "json");
  const format: FormatType = VALID_FORMATS.includes(rawFormat as FormatType)
    ? (rawFormat as FormatType)
    : "json";

  const service = getEnvString("SERVICE_NAME", "app");
  const environment = getEnvString("NODE_ENV", "development");

  const config: Readonly<LoggerConfig> = Object.freeze({
    level,
    format,
    transports: Object.freeze([...transports]),
    service,
    environment,
  });

  const log = buildLog(
    SOURCE,
    `Config built: level=${config.level} format=${config.format} service=${config.service} env=${config.environment}`,
  );

  return {
    nextState: transitionState(state, { format: config.format, appendLog: log }),
    config,
  };
}
