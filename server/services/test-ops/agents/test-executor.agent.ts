import { execCommand } from "../../utils/exec.util.js";

import type { ExecutorResult, RunnerConfig } from "../types.js";
import { buildTestCommand } from "../utils/command-builder.util.js";
import { appendLog } from "../utils/logger.util.js";
import { withTimeout } from "../utils/timeout.util.js";

export async function executeTests(config: RunnerConfig, files: readonly string[]): Promise<ExecutorResult> {
  let logs = Object.freeze([]) as readonly string[];

  const built = buildTestCommand(config, files);
  logs = appendLog(logs, "INFO", `Executing command: ${built.command} ${built.args.join(" ")}`);

  const output = await withTimeout(
    execCommand(built.command, built.args, {
      cwd: config.cwd,
      timeout: config.timeoutMs,
    }),
    config.timeoutMs ?? 60_000,
    "Test execution timed out",
  );

  logs = appendLog(logs, output.code === 0 ? "INFO" : "WARN", `Execution finished with code ${output.code ?? -1}`);

  return Object.freeze({
    stdout: output.stdout,
    stderr: output.stderr,
    exitCode: output.code ?? 1,
    logs,
  });
}
