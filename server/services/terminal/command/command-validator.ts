/**
 * server/services/terminal/command/command-validator.ts
 *
 * Guards against dangerous or malformed command strings.
 */

export class CommandValidationError extends Error {
  constructor(message: string) {
    super(`[command-validator] ${message}`);
    this.name = 'CommandValidationError';
  }
}

const BLOCKED: ReadonlyArray<RegExp> = [
  /\x00/,                           // null bytes
  /rm\s+-rf\s+\/(?:\s|$)/,         // rm -rf /
  />\s*\/dev\/(?:sda|hda|nvme)/,   // raw device writes
  /:\s*\(\s*\)\s*\{.*\}\s*;.*:/,  // fork bomb
  /mkfs\./,                         // filesystem format
];

export interface ValidationResult {
  valid:   boolean;
  reason?: string;
}

export const commandValidator = {
  validate(command: string): ValidationResult {
    if (!command || !command.trim()) {
      return { valid: false, reason: 'Command must be a non-empty string.' };
    }

    for (const pattern of BLOCKED) {
      if (pattern.test(command)) {
        return { valid: false, reason: `Command matches blocked pattern: ${pattern}` };
      }
    }

    return { valid: true };
  },

  assert(command: string): void {
    const result = commandValidator.validate(command);
    if (!result.valid) {
      throw new CommandValidationError(result.reason ?? 'Invalid command.');
    }
  },
};
