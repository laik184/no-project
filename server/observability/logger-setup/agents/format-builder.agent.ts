import { transitionState } from "../state.js";
import type { FormatType, LogEntry, LoggerConfig, LoggerState } from "../types.js";
import { formatEntry } from "../utils/formatter.util.js";
import { buildLog } from "../utils/logger.util.js";

const SOURCE = "format-builder";

export interface FormatBuilderResult {
  readonly nextState: Readonly<LoggerState>;
  readonly format: FormatType;
  readonly serialize: (entry: LogEntry) => string;
}

export function buildFormat(
  state: Readonly<LoggerState>,
  config: Readonly<LoggerConfig>,
): Readonly<FormatBuilderResult> {
  const format: FormatType = config.format;

  function serialize(entry: LogEntry): string {
    return formatEntry(entry, format);
  }

  const log = buildLog(SOURCE, `Format configured: ${format}`);

  return {
    nextState: transitionState(state, { format, appendLog: log }),
    format,
    serialize,
  };
}
