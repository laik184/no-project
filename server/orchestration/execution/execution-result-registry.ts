export interface ExecutionStats {
  runId: string;
  projectId: number;
  goal: string;
  success: boolean;
  totalSteps: number;
  stopReason: string;
  summary: string;
  verificationRetries: number;
  totalToolCalls: number;
  unknownToolCalls: number;
  failedToolCalls: number;
  messages: unknown[];
  error?: string;
}

const registry = new Map<string, ExecutionStats>();

export function storeExecutionStats(stats: ExecutionStats): void {
  registry.set(stats.runId, stats);
}

export function getExecutionStats(runId: string): ExecutionStats | undefined {
  return registry.get(runId);
}

export function getRecentRuns(limit = 20): ExecutionStats[] {
  const all = Array.from(registry.values());
  return all.slice(-limit);
}

export function getSuccessRate(): number {
  const all = Array.from(registry.values());
  if (all.length === 0) return 0;
  return all.filter((s) => s.success).length / all.length;
}

export function clearRun(runId: string): void {
  registry.delete(runId);
}
