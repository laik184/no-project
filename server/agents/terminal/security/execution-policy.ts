import type { PolicyDecision } from '../types/execution.types.ts';
import { checkCommandSafety } from './command-safety.ts';
import { getLimitsForCommand } from './resource-limits.ts';

export interface PolicyContext {
  command:   string;
  projectId: string;
  runId:     string;
  elapsedMs?: number;
  memoryMb?:  number;
}

export function evaluateExecutionPolicy(ctx: PolicyContext): PolicyDecision {
  const safety = checkCommandSafety(ctx.command);
  if (!safety.allowed) return safety;

  const limits = getLimitsForCommand(ctx.command);

  if (ctx.elapsedMs !== undefined && ctx.elapsedMs > limits.maxRuntimeMs) {
    return { allowed: false, reason: `Execution time ${ctx.elapsedMs}ms exceeds limit ${limits.maxRuntimeMs}ms` };
  }

  if (ctx.memoryMb !== undefined && ctx.memoryMb > limits.maxMemoryMb) {
    return { allowed: false, reason: `Memory ${ctx.memoryMb}MB exceeds limit ${limits.maxMemoryMb}MB` };
  }

  return { allowed: true };
}

export function isCommandAllowedInPolicy(command: string): boolean {
  return checkCommandSafety(command).allowed;
}
