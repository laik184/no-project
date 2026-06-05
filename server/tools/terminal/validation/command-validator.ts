/**
 * server/tools/terminal/validation/command-validator.ts
 *
 * Validates shell command strings before execution.
 */

const BLOCKED_PATTERNS = [
  /\x00/,          // null bytes
  /rm\s+-rf\s+\//,  // rm -rf /
  /:\s*\(\s*\)\s*\{.*\}\s*;.*:/,  // fork bomb
];

export class CommandValidationError extends Error {
  constructor(message: string) {
    super(`[command-validator] ${message}`);
    this.name = 'CommandValidationError';
  }
}

export function validateCommand(command: unknown): string {
  if (typeof command !== 'string' || !command.trim()) {
    throw new CommandValidationError('command must be a non-empty string.');
  }
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(command)) {
      throw new CommandValidationError(`command contains a blocked pattern: ${pattern}`);
    }
  }
  return command.trim();
}

export function assertCommand(command: unknown): string {
  return validateCommand(command);
}
