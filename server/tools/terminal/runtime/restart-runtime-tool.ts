/**
 * server/tools/terminal/runtime/restart-runtime-tool.ts
 * Tool: terminal_restart_runtime
 */

import { spawn }   from 'child_process';
import { join }    from 'path';
import type { ToolDefinition, ToolExecutionContext } from '../contracts/index.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { assertCommand }                             from '../validation/command-validator.ts';
import { getProcess, deleteProcess, setProcess, isRunning, appendLog } from './process-store.ts';

export const restartRuntimeTool: ToolDefinition = {
  name:        'terminal_restart_runtime',
  category:    'terminal',
  description: 'Restart the runtime process for a project (stop then start).',
  inputSchema: {
    projectId: { type: 'number', description: 'Project identifier',                        required: true  },
    command:   { type: 'string', description: 'Command to run after restart (inherits previous if omitted)', required: false },
    cwd:       { type: 'string', description: 'Working directory relative to sandbox root', required: false },
  },
  permissions: ['execute', 'process'],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const projectId = Number(input.projectId);
    const existing  = getProcess(projectId);
    const command   = assertCommand(String(input.command ?? existing?.command ?? ''));
    const cwd       = input.cwd ? join(ctx.sandboxRoot, String(input.cwd)) : ctx.sandboxRoot;

    if (isRunning(projectId) && existing) {
      try { existing.process.kill('SIGTERM'); } catch { /* gone */ }
      deleteProcess(projectId);
      await new Promise(r => setTimeout(r, 300));
    }

    const [cmd, ...args] = command.split(/\s+/);
    const proc = spawn(cmd, args, {
      cwd,
      env:   { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    setProcess(projectId, {
      pid: proc.pid ?? 0,
      command,
      projectId,
      startedAt: Date.now(),
      process: proc,
      logs: [],
    });

    proc.stdout?.on('data', (d: Buffer) => appendLog(projectId, d.toString()));
    proc.stderr?.on('data', (d: Buffer) => appendLog(projectId, d.toString()));

    return { projectId, pid: proc.pid, restarted: true };
  },
};
