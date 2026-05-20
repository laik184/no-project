import { buildPackageCommand } from "../utils/command-builder.util.js";
import { parsePackageNamesFromOutput } from "../utils/output-parser.util.js";
import { spawnProcess } from "../utils/process-spawn.util.js";
import type { InstallOptions, PackageManager, RunnerExecutionResult } from "../types.js";

export async function runRemove(
  manager: PackageManager,
  packages: readonly string[],
  options: Readonly<InstallOptions>,
): Promise<RunnerExecutionResult> {
  const command = buildPackageCommand(manager, "remove", packages, options);
  const result = await spawnProcess({
    command: command.command,
    args: command.args,
    cwd: options.cwd ?? process.cwd(),
    timeoutMs: options.timeoutMs ?? 120_000,
  });

  return Object.freeze({
    ok: result.exitCode === 0 && !result.timedOut,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    command: command.printable,
    parsedPackages: parsePackageNamesFromOutput(`${result.stdout}\n${result.stderr}`),
  });
}
