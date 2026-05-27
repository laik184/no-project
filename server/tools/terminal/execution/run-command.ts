import { shellExecute } from './shell-execute.ts';
import { getSandboxRoot } from '../validation/sandbox-validator.ts';
import { enforceExecutionPolicy } from '../security/execution-policy.ts';
import { CommandBlockedError } from '../shared/terminal-errors.ts';
import type { ExecutionOptions, ExecutionResult } from '../shared/terminal-types.ts';

export async function runCommand(opts: ExecutionOptions): Promise<ExecutionResult> {
  const policy = enforceExecutionPolicy(opts.command);
  if (!policy.allowed) throw new CommandBlockedError(opts.command, policy.reason ?? 'Blocked');

  const cwd = opts.projectId
    ? getSandboxRoot(opts.projectId)
    : process.cwd();

  return shellExecute(opts.command, cwd, opts.timeoutMs ?? 30_000, opts.env);
}
