/**
 * server/tools/terminal/runtime/start-runtime-tool.ts
 * Tool: terminal_start_runtime
 *
 * Starts a long-running process (e.g. npm start) for a project.
 */

import { spawn }   from 'child_process';
import { join }    from 'path';
import type { ToolDefinition, ToolExecutionContext } from '../contracts/index.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { assertCommand }                             from '../validation/command-validator.ts';
import { setProcess, isRunning, getProcess, appendLog } from './process-store.ts';

export const startRuntimeTool: ToolDefinition = {
  name:        'terminal_start_runtime',
  category:    'terminal',
  description: 'Start a long-running runtime process for a project (e.g. npm start, node server.js).',
  inputSchema: {
    projectId: { type: 'number', description: 'Project identifier',                          required: true  },
    command:   { type: 'string', description: 'Command to run (e.g. "npm start")',            required: true  },
    cwd:       { type: 'string', description: 'Working directory relative to sandbox root',   required: false },
  },
  permissions: ['execute', 'process'],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const projectId = Number(input.projectId);
    const command   = assertCommand(input.command);
    const cwd       = input.cwd ? join(ctx.sandboxRoot, String(input.cwd)) : ctx.sandboxRoot;

    if (isRunning(projectId)) {
      const existing = getProcess(projectId);
      return { projectId, pid: existing?.pid, running: true, message: 'Already running.' };
    }

    const [cmd, ...args] = command.split(/\s+/);
    const proc = spawn(cmd, args, {
      cwd,
      env:   { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
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

    return { projectId, pid: proc.pid, running: true };
  },
};
