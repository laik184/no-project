import { releaseRunPorts } from '../ports/release-run-ports.ts';
import { processHistory }  from '../state/process-history.ts';
import type { ToolDefinition } from '../../registry/tool-types.ts';

export function cleanupRun(runId: string): void {
  releaseRunPorts(runId);
  processHistory.clear(runId);
}

export const cleanupRunTool: ToolDefinition = {
  name: 'cleanup_run', category: 'terminal',
  description: 'Clean up all resources for a run (ports, history)',
  inputSchema: { runId: { type: 'string', description: 'Run ID', required: true } },
  permissions: ['process'], timeoutMs: 5_000,
  retry: { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler: async (input: Record<string, unknown>) => { cleanupRun(input.runId as string); return { ok: true }; },
};
