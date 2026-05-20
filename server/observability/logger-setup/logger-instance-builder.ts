import type {
  LogEntry,
  LoggerInstance,
  LogLevel,
  TransportConfig,
} from "./types.js";
import { dispatchEntry, isLevelEnabled } from "./transport-writer.js";

export interface LoggerInstanceConfig {
  readonly level: LogLevel;
  readonly service: string;
  readonly environment: string;
  readonly transports: readonly Readonly<TransportConfig>[];
  readonly serialize: (entry: Readonly<LogEntry>) => string;
}

function buildEntry(
  level: LogLevel,
  message: string,
  cfg: LoggerInstanceConfig,
  meta?: Record<string, unknown>,
  requestId?: string,
  error?: Error,
): Readonly<LogEntry> {
  return Object.freeze({
    timestamp: new Date().toISOString(),
    level,
    message,
    requestId,
    service: cfg.service,
    environment: cfg.environment,
    ...(meta ? { meta: Object.freeze(meta) } : {}),
    ...(error
      ? {
          error: Object.freeze({
            name: error.name,
            message: error.message,
            stack: error.stack,
          }),
        }
      : {}),
  });
}

export function buildLoggerInstance(cfg: LoggerInstanceConfig): Readonly<LoggerInstance> {
  return Object.freeze({
    info(message, meta, requestId) {
      if (!isLevelEnabled("info", cfg.level)) return;
      dispatchEntry(buildEntry("info", message, cfg, meta, requestId), cfg.serialize, cfg.transports);
    },
    warn(message, meta, requestId) {
      if (!isLevelEnabled("warn", cfg.level)) return;
      dispatchEntry(buildEntry("warn", message, cfg, meta, requestId), cfg.serialize, cfg.transports);
    },
    error(message, error, meta, requestId) {
      if (!isLevelEnabled("error", cfg.level)) return;
      dispatchEntry(
        buildEntry("error", message, cfg, meta, requestId, error),
        cfg.serialize,
        cfg.transports,
      );
    },
    debug(message, meta, requestId) {
      if (!isLevelEnabled("debug", cfg.level)) return;
      dispatchEntry(buildEntry("debug", message, cfg, meta, requestId), cfg.serialize, cfg.transports);
    },
  });
}
