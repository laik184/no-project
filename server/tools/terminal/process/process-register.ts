import { processManager } from '../../../agents/terminal/process/process-manager.ts';
import type { ProcessRecord } from '../shared/terminal-types.ts';
import type { ToolDefinition } from '../../registry/tool-types.ts';

export function registerProcess(runId: string, command: string, pid: number): ProcessRecord {
  return processManager.register(runId, command, pid) as unknown as ProcessRecord;
}

export const processRegisterTool: ToolDefinition = {
  name: 'process_register', category: 'terminal',
  description: 'Register a running process',
  inputSchema: {
    runId:   { type: 'string', description: 'Run ID',   required: true },
    command: { type: 'string', description: 'Command',  required: true },
    pid:     { type: 'number', description: 'PID',      required: true },
  },
  permissions: ['process'], timeoutMs: 1_000,
  retry: { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler: async (input: Record<string, unknown>) =>
    registerProcess(input.runId as string, input.command as string, Number(input.pid)),
};
