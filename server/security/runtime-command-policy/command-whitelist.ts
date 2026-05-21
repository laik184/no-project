/**
 * server/security/runtime-command-policy/command-whitelist.ts
 *
 * Allowlist for commands that may launch long-running runtime processes.
 * Intentionally narrower than the tool-execution allowlist — only process
 * starters and package managers that legitimately run dev servers.
 *
 * Single responsibility: define what is permitted as a runtime process command.
 */

/** Commands allowed to launch a long-running runtime process. */
export const RUNTIME_ALLOWED_COMMANDS = new Set<string>([
  "npm",
  "npx",
  "node",
  "pnpm",
  "yarn",
  "vite",
  "bun",
  "tsx",
  "ts-node",
  "next",
]);

/** Shell metacharacters that must never appear in a runtime command string. */
export const INJECTION_RE = /&&|\|\||[|;&`$<>()\n\r"'{}[\]\\!]/;

/** Maximum allowed length of the full raw command string. */
export const MAX_COMMAND_LENGTH = 512;

/** Maximum allowed length of any single argument. */
export const MAX_ARG_LENGTH = 256;
