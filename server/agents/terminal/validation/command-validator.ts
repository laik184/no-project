/**
 * server/agents/terminal/validation/command-validator.ts
 *
 * Validates commands before they are dispatched to the terminal tool layer.
 * Blocks dangerous patterns, malformed inputs, and disallowed operations.
 */

import type { ValidationResult } from '../types/terminal.types.ts';

const BLOCKED_PATTERNS: ReadonlyArray<RegExp> = [
  /rm\s+-rf\s+\//,
  /:\(\)\s*\{.*\}/,         // fork bomb
  />\s*\/dev\/sd[a-z]/,     // raw disk write
  /dd\s+if=.*of=\/dev/,     // raw disk copy
  /mkfs\./,                 // format filesystem
  /shutdown|reboot|halt/,
  /iptables\s+-F/,          // flush firewall
  /passwd\s+root/,
];

const BLOCKED_COMMANDS: ReadonlySet<string> = new Set([
  'rm -rf /',
  'sudo su',
  'sudo bash',
  'sudo sh',
]);

const MAX_COMMAND_LENGTH = 4096;

export function validateCommand(command: string): ValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (!command || !command.trim()) {
    errors.push('Command must be a non-empty string');
    return { valid: false, errors, warnings };
  }

  if (command.length > MAX_COMMAND_LENGTH) {
    errors.push(`Command exceeds max length (${MAX_COMMAND_LENGTH} chars)`);
  }

  if (BLOCKED_COMMANDS.has(command.trim())) {
    errors.push(`Blocked command: "${command.trim()}"`);
  }

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(command)) {
      errors.push(`Command matches blocked pattern: ${pattern.source}`);
    }
  }

  if (/curl|wget/i.test(command) && /\|\s*sh/i.test(command)) {
    errors.push('Piping remote scripts to shell is not allowed');
  }

  if (command.includes('$(') || command.includes('`')) {
    warnings.push('Command contains subshell substitution — review carefully');
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validatePackageName(name: string): ValidationResult {
  const errors: string[] = [];
  if (!/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(name)) {
    errors.push(`Invalid package name: "${name}"`);
  }
  return { valid: errors.length === 0, errors, warnings: [] };
}
