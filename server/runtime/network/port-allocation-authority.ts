/**
 * server/runtime/network/port-allocation-authority.ts
 *
 * PortAllocationAuthority — atomic, run-scoped port reservation.
 *
 * Responsibilities:
 *   - Atomically allocate OS-confirmed free ports
 *   - Bind ports to a specific runId (ownership)
 *   - Detect and prevent port conflicts across concurrent runs
 *   - Sweep stale/orphan port reservations
 *   - Emit telemetry on all allocation lifecycle events
 *
 * Single responsibility: port ownership registry. No process/agent logic.
 */

import net    from "net";
import { bus } from "../../infrastructure/events/bus.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PortReservation {
  readonly port:      number;
  readonly runId:     string;
  readonly projectId: number;
  readonly allocatedAt: number;
  released:           boolean;
}

export interface AllocateResult {
  ok:      boolean;
  port?:   number;
  error?:  string;
}

// ── State ─────────────────────────────────────────────────────────────────────

const _reservations = new Map<number, PortReservation>();   // port → reservation
const _byRun        = new Map<string, Set<number>>();        // runId → Set<port>

// Ports that are structurally reserved by the platform and must never be allocated
const PLATFORM_RESERVED = new Set([22, 80, 443, 3000, 3001, 3002, 5000, 5173]);

// ── Telemetry ─────────────────────────────────────────────────────────────────

function emit(runId: string, projectId: number, eventType: string, payload: Record<string, unknown>): void {
  bus.emit("agent.event", {
    runId, projectId,
    phase: "port-authority",
    agentName: "port-allocation-authority",
    eventType, payload,
    ts: Date.now(),
  });
}

// ── OS-level free port probe ──────────────────────────────────────────────────

function probeFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address() as net.AddressInfo;
      srv.close(() => resolve(addr.port));
    });
    srv.on("error", (err) => reject(new Error(`Port probe failed: ${err.message}`)));
  });
}

async function findNonConflictingPort(maxAttempts = 10): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = await probeFreePort();
    if (!PLATFORM_RESERVED.has(port) && !_reservations.has(port)) return port;
  }
  throw new Error("Port allocation authority: exhausted attempts finding a conflict-free port");
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Atomically allocate a free port and bind it to a runId.
 * Uses OS port 0 binding to guarantee availability at allocation time.
 */
export async function allocatePort(runId: string, projectId: number): Promise<AllocateResult> {
  try {
    const port = await findNonConflictingPort();
    const reservation: PortReservation = {
      port, runId, projectId,
      allocatedAt: Date.now(),
      released: false,
    };
    _reservations.set(port, reservation);

    const runPorts = _byRun.get(runId) ?? new Set();
    runPorts.add(port);
    _byRun.set(runId, runPorts);

    emit(runId, projectId, "lock.acquired", { resource: "port", port, totalReserved: _reservations.size });
    return { ok: true, port };
  } catch (err: any) {
    emit(runId, projectId, "conflict.detected", { resource: "port", error: err.message });
    return { ok: false, error: err.message };
  }
}

/**
 * Release a specific port reservation.
 * Idempotent — safe to call multiple times.
 */
export function releasePort(port: number): void {
  const res = _reservations.get(port);
  if (!res || res.released) return;
  res.released = true;
  _reservations.delete(port);
  _byRun.get(res.runId)?.delete(port);
  emit(res.runId, res.projectId, "lock.released", { resource: "port", port });
}

/**
 * Release all ports owned by a specific run.
 * Called during run teardown / envelope termination.
 */
export function releaseRunPorts(runId: string): void {
  const ports = _byRun.get(runId);
  if (!ports) return;
  for (const port of ports) releasePort(port);
  _byRun.delete(runId);
}

/** Check if a port is currently reserved by any run. */
export function isPortReserved(port: number): boolean {
  return _reservations.has(port);
}

/** Get the reservation for a port (for conflict diagnostics). */
export function getReservation(port: number): PortReservation | undefined {
  return _reservations.get(port);
}

/** Get all ports reserved by a run. */
export function getRunPorts(runId: string): number[] {
  return Array.from(_byRun.get(runId) ?? []);
}

/**
 * Sweep stale reservations older than maxAgeMs.
 * Protects against orphaned ports from crashed runs.
 */
export function sweepStaleReservations(maxAgeMs = 3_600_000): number {
  const now = Date.now();
  let swept = 0;
  for (const [port, res] of _reservations) {
    if (!res.released && (now - res.allocatedAt) > maxAgeMs) {
      emit(res.runId, res.projectId, "conflict.detected", {
        resource: "stale-port", port, ageMs: now - res.allocatedAt,
      });
      _reservations.delete(port);
      _byRun.get(res.runId)?.delete(port);
      swept++;
    }
  }
  return swept;
}

/** Snapshot of all active reservations (monitoring). */
export function snapshot(): { totalReserved: number; byRun: Record<string, number[]> } {
  const byRun: Record<string, number[]> = {};
  for (const [runId, ports] of _byRun) byRun[runId] = Array.from(ports);
  return { totalReserved: _reservations.size, byRun };
}

// ── Background stale sweeper ──────────────────────────────────────────────────

let _sweepInterval: NodeJS.Timeout | null = null;

export function startSweeper(intervalMs = 300_000): void {
  if (_sweepInterval) return;
  _sweepInterval = setInterval(() => sweepStaleReservations(), intervalMs);
  _sweepInterval.unref?.();
}

export function stopSweeper(): void {
  if (_sweepInterval) { clearInterval(_sweepInterval); _sweepInterval = null; }
}
