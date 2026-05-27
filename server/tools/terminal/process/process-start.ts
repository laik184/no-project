/**
 * Fix #6  — Terminal sandbox bypass: handler uses ctx.sandboxRoot.
 * Fix #13 — Naive command parsing: handler uses parseShellArgs.
 */
import { spawnProcess }           from '../execution/spawn-process.ts';
import { registerProcess }        from './process-register.ts';
import { enforceExecutionPolicy } from '../security/execution-policy.ts';
import { CommandBlockedError }    from '../shared/terminal-errors.ts';
import { getSandboxRoot }         from '../validation/sandbox-validator.ts';
import { parseShellArgs }         from '../execution/parse-shell-args.ts';
import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';

export interface ProcessStartOptions {
  runId:     string;
  projectId: string;
  command:   string;
  cwd?:      string;
  env?:      Record<string, string>;
}

/** Core implementation — cwd must be a trusted sandbox root. */
export function startProcess(opts: ProcessStartOptions & { cwd: string }) {
  const policy = enforceExecutionPolicy(opts.command);
  if (!policy.allowed) throw new CommandBlockedError(opts.command, policy.reason ?? 'Blocked');

  const parts  = parseShellArgs(opts.command);
  if (parts.length === 0) throw new Error('Empty command');
  const handle = spawnProcess(parts[0], parts.slice(1), { cwd: opts.cwd, env: opts.env });
  registerProcess(opts.runId, opts.command, handle.pid);
  return { pid: handle.pid, spawnedAt: handle.spawnedAt };
}

export const processStartTool: ToolDefinition = {
  name: 'process_start', category: 'terminal',
  description: 'Start a process in the project sandbox',
  inputSchema: {
    runId:     { type: 'string', description: 'Run ID',     required: true },
    projectId: { type: 'string', description: 'Project ID (display only)', required: false },
    command:   { type: 'string', description: 'Command',    required: true },
  },
  permissions: ['execute', 'process'], timeoutMs: 10_000,
  retry: { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  // Fix #6: ctx.sandboxRoot replaces getSandboxRoot(input.projectId)
  handler: async (input: Record<string, unknown>, ctx: ToolExecutionContext) =>
    startProcess({
      runId:   ctx.runId,
      projectId: ctx.projectId,
      command: input.command as string,
      cwd:     ctx.sandboxRoot,
      env:     input.env as Record<string, string> | undefined,
    }),
};
