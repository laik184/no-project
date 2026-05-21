/**
 * server/security/runtime-command-policy/command-types.ts
 *
 * Shared types for the runtime command policy layer.
 * Single responsibility: type definitions only.
 */

/** A safely parsed command ready for shell-free spawn. */
export interface ParsedCommand {
  /** The executable name (e.g. "npm", "vite"). */
  cmd:  string;
  /** Positional arguments (e.g. ["run", "dev"]). */
  args: string[];
  /** Original raw string — kept for audit/telemetry. */
  raw:  string;
}

export interface CommandParseResult {
  ok:      boolean;
  parsed?: ParsedCommand;
  reason?: string;
}

export interface RuntimeCommandResult {
  ok:      boolean;
  parsed?: ParsedCommand;
  reason?: string;
}
