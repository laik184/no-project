export interface ExecutionStats {
  runId: string;
  tasksTotal: number;
  tasksCompleted: number;
  tasksFailed: number;
  durationMs: number;
  phases: string[];
  completedAt: Date;
}

const registry = new Map<string, ExecutionStats>();

export function storeExecutionStats(stats: ExecutionStats): void {
  registry.set(stats.runId, { ...stats, completedAt: stats.completedAt ?? new Date() });
}

export function getExecutionStats(runId: string): ExecutionStats | undefined {
  return registry.get(runId);
}

export function getAllExecutionStats(): ExecutionStats[] {
  return Array.from(registry.values()).sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
}

export function clearExecutionStats(runId: string): void {
  registry.delete(runId);
}

export function getRecentRuns(limit = 20): ExecutionStats[] {
  return getAllExecutionStats().slice(0, limit);
}

export function getSuccessRate(): number {
  const all = getAllExecutionStats();
  if (all.length === 0) return 0;
  const succeeded = all.filter((s) => s.tasksFailed === 0).length;
  return Math.round((succeeded / all.length) * 100);
}
