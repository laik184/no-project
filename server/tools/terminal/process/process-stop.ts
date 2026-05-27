import { processManager } from '../../../agents/terminal/process/process-manager.ts';
import { forceKill }      from '../execution/force-kill.ts';
import type { ToolDefinition } from '../../registry/tool-types.ts';

export async function stopProcess(id: string, pid: number): Promise<{ stopped: boolean }> {
  const killed = await forceKill(pid);
  if (killed) processManager.markStopped(id, 0);
  return { stopped: killed };
}

export const processStopTool: ToolDefinition = {
  name: 'process_stop', category: 'terminal',
  description: 'Stop a running process',
  inputSchema: {
    id:  { type: 'string', description: 'Process record ID', required: true },
    pid: { type: 'number', description: 'PID',               required: true },
  },
  permissions: ['process'], timeoutMs: 10_000,
  retry: { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler: async (input: Record<string, unknown>) =>
    stopProcess(input.id as string, Number(input.pid)),
};
