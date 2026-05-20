import type { RunnerConfig } from "../types.js";
import { appendLog } from "../utils/logger.util.js";

export interface TestRunContext {
  readonly config: RunnerConfig;
  readonly logs: readonly string[];
}

export function initializeTestRun(config: RunnerConfig = {}): TestRunContext {
  const normalizedConfig: RunnerConfig = Object.freeze({
    cwd: config.cwd,
    framework: config.framework ?? "vitest",
    timeoutMs: config.timeoutMs ?? 60_000,
    coverage: config.coverage ?? true,
  });

  const logs = appendLog(Object.freeze([]), "INFO", `Initialized test run with framework=${normalizedConfig.framework}`);
  return Object.freeze({ config: normalizedConfig, logs });
}
