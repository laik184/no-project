import type { ValidationResult } from "../types.js";
import { validateCommand } from "../../../../../services/shell/agents/command-validator.agent.js";
import { executeCommand } from "../../../../../services/shell/agents/shell-executor.agent.js";
import { monitorProcess } from "../../../../../services/shell/agents/process-monitor.agent.js";

function splitCommand(command: string): { command: string; args: readonly string[] } {
  const parts = command.trim().split(/\s+/).filter(Boolean);
  return {
    command: parts[0] ?? "npm",
    args: Object.freeze(parts.slice(1)),
  };
}

export async function validateFix(
  projectRoot: string,
  validationCommand = "npm test",
): Promise<ValidationResult> {
  const parsed = splitCommand(validationCommand);

  let validated;
  try {
    validated = validateCommand({
      command: parsed.command,
      args: parsed.args,
      cwd: projectRoot,
      allowedCwd: projectRoot,
      timeoutMs: 120_000,
    });
  } catch (error) {
    return Object.freeze({
      ok: false,
      command: validationCommand,
      output: error instanceof Error ? error.message : String(error),
      logs: Object.freeze([
        `Validation command rejected: ${validationCommand}`,
        error instanceof Error ? error.message : String(error),
      ]),
    });
  }

  const handle = executeCommand(validated);
  const monitored = await monitorProcess(handle.process);
  const text = [...monitored.stdout, ...monitored.stderr].join("");
  const exitCode = monitored.exitCode ?? -1;

  return Object.freeze({
    ok: exitCode === 0,
    command: validationCommand,
    output: text,
    logs: Object.freeze([
      `Validation command: ${validationCommand}`,
      `Exit code: ${exitCode}`,
    ]),
  });
}
