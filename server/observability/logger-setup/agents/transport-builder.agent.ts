import { transitionState } from "../state.js";
import type { LoggerState, TransportConfig } from "../types.js";
import { getEnvBool, getEnvString } from "../utils/env.util.js";
import { buildLog } from "../utils/logger.util.js";

const SOURCE = "transport-builder";

export interface TransportBuilderResult {
  readonly nextState: Readonly<LoggerState>;
  readonly transports: readonly TransportConfig[];
}

export function buildTransports(
  state: Readonly<LoggerState>,
): Readonly<TransportBuilderResult> {
  const configs: TransportConfig[] = [];

  const consoleEnabled = getEnvBool("LOG_CONSOLE", true);
  if (consoleEnabled) {
    configs.push(
      Object.freeze<TransportConfig>({
        type: "console",
        colorize: getEnvBool("LOG_COLORIZE", false),
      }),
    );
  }

  const fileEnabled = getEnvBool("LOG_FILE", false);
  if (fileEnabled) {
    const filePath = getEnvString("LOG_FILE_PATH", "logs/app.log");
    configs.push(
      Object.freeze<TransportConfig>({
        type: "file",
        filePath,
      }),
    );
  }

  const transports = Object.freeze(configs);
  const names = configs.map((t) => t.type).join(", ") || "none";
  const log = buildLog(SOURCE, `Transports built: [${names}]`);

  return {
    nextState: transitionState(state, { transports, appendLog: log }),
    transports,
  };
}
