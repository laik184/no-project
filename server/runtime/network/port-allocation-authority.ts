/**
 * server/runtime/network/port-allocation-authority.ts
 *
 * Port allocation authority — manages port reservations for project
 * child processes and sweeps stale/zombie reservations periodically.
 */

interface PortReservation {
  projectId: number;
  runId: string;
  port: number;
  reservedAt: number;
  ttlMs: number;
}

const reservations = new Map<number, PortReservation>();
let sweeperTimer: NodeJS.Timeout | null = null;

const BASE_PORT = 4100;
const MAX_PORT  = 4999;
const DEFAULT_TTL_MS = 30 * 60 * 1_000; // 30 min

function nextFreePort(): number {
  const used = new Set(reservations.keys());
  for (let p = BASE_PORT; p <= MAX_PORT; p++) {
    if (!used.has(p)) return p;
  }
  throw new Error('[port-authority] Port pool exhausted');
}

export const portAllocationAuthority = {
  reserve(projectId: number, runId: string, ttlMs = DEFAULT_TTL_MS): number {
    const existing = [...reservations.values()].find(
      (r) => r.projectId === projectId && r.runId === runId,
    );
    if (existing) return existing.port;

    const port = nextFreePort();
    reservations.set(port, { projectId, runId, port, reservedAt: Date.now(), ttlMs });
    return port;
  },

  release(port: number): void {
    reservations.delete(port);
  },

  releaseByRun(runId: string): void {
    for (const [port, r] of reservations) {
      if (r.runId === runId) reservations.delete(port);
    }
  },

  isReserved(port: number): boolean {
    return reservations.has(port);
  },

  sweep(): number {
    const now = Date.now();
    let swept = 0;
    for (const [port, r] of reservations) {
      if (now - r.reservedAt > r.ttlMs) {
        reservations.delete(port);
        swept++;
      }
    }
    return swept;
  },

  list(): PortReservation[] {
    return [...reservations.values()];
  },
};

export function startSweeper(intervalMs = 5 * 60 * 1_000): void {
  if (sweeperTimer) return;
  sweeperTimer = setInterval(() => {
    const swept = portAllocationAuthority.sweep();
    if (swept > 0) {
      console.log(`[port-authority] Swept ${swept} stale port reservation(s)`);
    }
  }, intervalMs);
}

export function stopSweeper(): void {
  if (sweeperTimer) {
    clearInterval(sweeperTimer);
    sweeperTimer = null;
  }
}
