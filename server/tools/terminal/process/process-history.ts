import { processHistory } from '../state/process-history.ts';
import type { ToolDefinition } from '../../registry/tool-types.ts';

export { processHistory };

export const processHistoryTool: ToolDefinition = {
  name: 'process_history', category: 'terminal',
  description: 'Get process execution history for a run',
  inputSchema: { runId: { type: 'string', description: 'Run ID', required: true } },
  permissions: ['process'], timeoutMs: 1_000,
  retry: { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler: async (input: Record<string, unknown>) =>
    ({ entries: processHistory.getForRun(input.runId as string) }),
};
