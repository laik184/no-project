import { spawnProcess }    from '../execution/spawn-process.ts';
import { registerProcess } from './process-register.ts';
import { enforceExecutionPolicy } from '../security/execution-policy.ts';
import { CommandBlockedError } from '../shared/terminal-errors.ts';
import { getSandboxRoot } from '../validation/sandbox-validator.ts';
import type { ToolDefinition } from '../../registry/tool-types.ts';

export interface ProcessStartOptions {
  runId:     string;
  projectId: string;
  command:   string;
  env?:      Record<string, string>;
}

export function startProcess(opts: ProcessStartOptions) {
  const policy = enforceExecutionPolicy(opts.command);
  if (!policy.allowed) throw new CommandBlockedError(opts.command, policy.reason ?? 'Blocked');

  const cwd   = getSandboxRoot(opts.projectId);
  const parts = opts.command.split(/\s+/);
  const handle = spawnProcess(parts[0], parts.slice(1), { cwd, env: opts.env });
  registerProcess(opts.runId, opts.command, handle.pid);
  return { pid: handle.pid, spawnedAt: handle.spawnedAt };
}

export const processStartTool: ToolDefinition = {
  name: 'process_start', category: 'terminal',
  description: 'Start a process in the project sandbox',
  inputSchema: {
    runId:     { type: 'string', description: 'Run ID',     required: true },
    projectId: { type: 'string', description: 'Project ID', required: true },
    command:   { type: 'string', description: 'Command',    required: true },
  },
  permissions: ['execute', 'process'], timeoutMs: 10_000,
  retry: { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler: async (input: Record<string, unknown>) => startProcess(input as ProcessStartOptions),
};
