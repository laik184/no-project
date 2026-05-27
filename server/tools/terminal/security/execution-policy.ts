import { checkCommandSafety } from './command-safety.ts';
import type { PolicyDecision } from '../shared/terminal-types.ts';

const ALLOWED_EXECUTABLES = new Set([
  'npm', 'npx', 'pnpm', 'node', 'tsx', 'tsc', 'git', 'ls', 'mkdir',
  'echo', 'cat', 'cp', 'mv', 'touch', 'find', 'grep', 'sed', 'awk',
  'curl', 'wget', 'unzip', 'tar', 'python3', 'python', 'pip', 'pip3',
]);

export function enforceExecutionPolicy(command: string): PolicyDecision {
  const safety = checkCommandSafety(command);
  if (!safety.allowed) return safety;

  const executable = command.trim().split(/\s+/)[0];
  if (executable && !ALLOWED_EXECUTABLES.has(executable)) {
    return { allowed: false, reason: `Executable not whitelisted: "${executable}"` };
  }

  return { allowed: true };
}

export function getDefaultTimeoutMs(command: string): number {
  if (/^npm\s+(install|ci)\b/.test(command))  return 120_000;
  if (/^npm\s+(build|run)\b/.test(command))   return  60_000;
  if (/^npm\s+test\b/.test(command))           return  60_000;
  return 30_000;
}
