/**
 * server/services/terminal/runtime/runtime-health-service.ts
 *
 * Health checks for running runtime processes.
 * Uses process.kill(pid, 0) to probe liveness without signalling.
 */

export interface HealthStatus {
  sessionId: string;
  pid:       number;
  alive:     boolean;
  checkedAt: number;
}

export const runtimeHealthService = {
  check(sessionId: string, pid: number): HealthStatus {
    let alive = false;
    if (pid > 0) {
      try {
        process.kill(pid, 0);
        alive = true;
      } catch { /* ESRCH = not found */ }
    }

    return { sessionId, pid, alive, checkedAt: Date.now() };
  },

  checkMany(entries: Array<{ sessionId: string; pid: number }>): HealthStatus[] {
    return entries.map(e => this.check(e.sessionId, e.pid));
  },

  isAlive(pid: number): boolean {
    if (!pid || pid <= 0) return false;
    try { process.kill(pid, 0); return true; } catch { return false; }
  },
};
