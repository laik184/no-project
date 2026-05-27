interface RuntimeState {
  totalSteps:   number;
  passedSteps:  number;
  failedSteps:  number;
  startedAt:    Date;
}

const states = new Map<string, RuntimeState>();

export const runtimeMonitor = {
  init(runId: string, totalTasks: number): void {
    states.set(runId, {
      totalSteps:  totalTasks,
      passedSteps: 0,
      failedSteps: 0,
      startedAt:   new Date(),
    });
  },

  recordStep(runId: string, success: boolean): void {
    const s = states.get(runId);
    if (!s) return;
    if (success) s.passedSteps++;
    else         s.failedSteps++;
  },

  isHealthy(runId: string): boolean {
    const s = states.get(runId);
    if (!s) return true;
    const total   = s.passedSteps + s.failedSteps;
    if (total < 3) return true;
    const failRate = s.failedSteps / total;
    return failRate < 0.5;
  },

  getStats(runId: string) {
    return states.get(runId) ?? null;
  },

  clear(runId: string): void {
    states.delete(runId);
  },
};
