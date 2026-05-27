import { isPortInUse } from '../ports/find-free-port.ts';
import type { ToolDefinition } from '../../registry/tool-types.ts';

export interface WatchResult {
  alive:    boolean;
  portOpen: boolean;
  checkedAt: number;
}

export async function watchProcess(pid: number, port?: number): Promise<WatchResult> {
  let alive = false;
  try { process.kill(pid, 0); alive = true; } catch { /* not running */ }
  const portOpen = port ? await isPortInUse(port) : false;
  return { alive, portOpen, checkedAt: Date.now() };
}

export const processWatchTool: ToolDefinition = {
  name: 'process_watch', category: 'terminal',
  description: 'Watch a process for health and port status',
  inputSchema: {
    pid:  { type: 'number', description: 'PID',           required: true },
    port: { type: 'number', description: 'Port to check' },
  },
  permissions: ['process'], timeoutMs: 5_000,
  retry: { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler: async (input: Record<string, unknown>) =>
    watchProcess(Number(input.pid), input.port ? Number(input.port) : undefined),
};
