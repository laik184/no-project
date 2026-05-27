import { enforceExecutionPolicy } from '../security/execution-policy.ts';
import type { ValidationResult } from '../shared/terminal-types.ts';
import { CommandBlockedError } from '../shared/terminal-errors.ts';

export function validateCommand(command: string): string {
  if (!command?.trim()) throw new CommandBlockedError(command, 'Empty command');
  const policy = enforceExecutionPolicy(command);
  if (!policy.allowed) throw new CommandBlockedError(command, policy.reason ?? 'Policy blocked');
  return command.trim();
}

export function validateCommandSafe(command: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!command?.trim()) errors.push('Command is empty');
  const policy = enforceExecutionPolicy(command);
  if (!policy.allowed) errors.push(policy.reason ?? 'Blocked by policy');
  return { valid: errors.length === 0, errors, warnings };
}
