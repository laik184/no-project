import * as path from "node:path";
import type { CommandInput, ValidatedCommand } from "../types.js";
import {
  hasInjectionTokens,
  normalizeArgs,
  sanitizeToken,
} from "../utils/command-parser.util.js";

const BLOCKED_COMMANDS = new Set([
  "rm",
  "shutdown",
  "reboot",
  "mkfs",
  "dd",
  "poweroff",
  "halt",
]);

const ALLOWED_COMMANDS = new Set([
  "npm",
  "node",
  "npx",
  "pnpm",
  "yarn",
  "bun",
  "tsc",
  "tsx",
  "git",
]);

const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_TIMEOUT_MS = 300_000;

export function validateCommand(input: Readonly<CommandInput>): Readonly<ValidatedCommand> {
  const command = sanitizeToken(input.command);
  const args = normalizeArgs(input.args);

  if (command.length === 0) {
    throw new Error("Command is required.");
  }

  if (hasInjectionTokens(command) || args.some((arg) => hasInjectionTokens(arg))) {
    throw new Error("Unsafe command tokens detected.");
  }

  if (BLOCKED_COMMANDS.has(command)) {
    throw new Error(`Blocked command: ${command}`);
  }

  if (command === "rm" && args.some((arg) => arg.includes("-rf") || arg.includes("--no-preserve-root"))) {
    throw new Error("Dangerous rm usage is blocked.");
  }

  if (!ALLOWED_COMMANDS.has(command)) {
    throw new Error(`Command not permitted: ${command}`);
  }

  const allowedRoot = path.resolve(input.allowedCwd ?? process.cwd());
  const cwd = path.resolve(input.cwd ?? allowedRoot);

  if (!cwd.startsWith(allowedRoot)) {
    throw new Error("Execution scope violation: cwd is outside allowed root.");
  }

  const timeoutMs = Math.max(1_000, Math.min(input.timeoutMs ?? DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS));

  return Object.freeze<ValidatedCommand>({
    command,
    args,
    cwd,
    env: input.env,
    timeoutMs,
  });
}
