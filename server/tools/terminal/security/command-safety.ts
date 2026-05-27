import { isCommandBlocked } from './blocked-commands.ts';
import type { PolicyDecision } from '../shared/terminal-types.ts';

export function checkCommandSafety(command: string): PolicyDecision {
  const { blocked, reason } = isCommandBlocked(command);
  if (blocked) return { allowed: false, reason };
  return { allowed: true };
}

export function containsShellMeta(command: string): boolean {
  return /[;&|`$(){}[\]<>]/.test(command);
}

export function isReadOnlyGit(command: string): boolean {
  return /^git\s+(status|log|diff|show|branch)\b/.test(command.trim());
}

export function sanitizeCommand(command: string): string {
  return command.trim().replace(/\s+/g, ' ');
}
