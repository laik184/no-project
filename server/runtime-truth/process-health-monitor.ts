/**
 * server/runtime-truth/process-health-monitor.ts
 *
 * ProcessHealthMonitor — deterministic process liveness verification.
 * Checks: PID alive, port open, crash loop detection, memory probe.
 * No log scanning. Evidence is from OS primitives only.
 */

import net from "net";
import { execSync } from "child_process";
import type { ProcessHealthReport, EvidenceItem } from "./types.ts";

const CRASH_LOOP_THRESHOLD = 3;
const CRASH_WINDOW_MS = 60_000;
const PORT_PROBE_TIMEOUT_MS = 3_000;
const STABILITY_WINDOW_MS = 5_000;

interface RestartRecord {
  ts: number;
}

// ─── Per-project restart history ──────────────────────────────────────────────

const _restartHistory = new Map<number, RestartRecord[]>();

export class ProcessHealthMonitor {
  recordRestart(projectId: number): void {
    const history = _restartHistory.get(projectId) ?? [];
    history.push({ ts: Date.now() });
    // Prune entries outside the window
    const cutoff = Date.now() - CRASH_WINDOW_MS;
    _restartHistory.set(projectId, history.filter((r) => r.ts > cutoff));
  }

  async check(opts: {
    projectId: number;
    pid: number | null;
    port: number | null;
  }): Promise<{ report: ProcessHealthReport; evidence: readonly EvidenceItem[] }> {
    const t0 = Date.now();
    const { projectId, pid, port } = opts;

    const alive = pid !== null ? this._isPidAlive(pid) : false;
    const portOpen = port !== null ? await this._isPortOpen(port) : false;
    const restarts = this._crashLoopCount(projectId);
    const inCrashLoop = restarts >= CRASH_LOOP_THRESHOLD;
    const memoryMb = pid !== null && alive ? this._readMemoryMb(pid) : null;
    const uptimeMs = pid !== null && alive ? this._readUptimeMs(pid) : 0;

    const report: ProcessHealthReport = Object.freeze({
      pid,
      alive,
      port,
      portOpen,
      restartCount: restarts,
      inCrashLoop,
      uptimeMs,
      memoryMb,
      durationMs: Date.now() - t0,
    });

    const now = Date.now();
    const evidence: EvidenceItem[] = [
      {
        kind: "PID_ALIVE",
        value: alive,
        detail: alive ? `PID ${pid} is alive` : `PID ${pid ?? "null"} not found`,
        collectedAt: now,
        ttlMs: 10_000,
      },
      {
        kind: "PORT_OPEN",
        value: portOpen,
        detail: portOpen ? `Port ${port} accepts connections` : `Port ${port ?? "?"} unreachable`,
        collectedAt: now,
        ttlMs: 10_000,
      },
      {
        kind: "CRASH_LOOP_ABSENT",
        value: !inCrashLoop,
        detail: inCrashLoop
          ? `Crash loop detected: ${restarts} restarts in ${CRASH_WINDOW_MS / 1000}s`
          : `No crash loop (${restarts} restarts)`,
        collectedAt: now,
        ttlMs: CRASH_WINDOW_MS,
      },
      {
        kind: "PROCESS_STABLE",
        value: alive && portOpen && !inCrashLoop && uptimeMs >= STABILITY_WINDOW_MS,
        detail: `Uptime ${Math.round(uptimeMs / 1000)}s`,
        collectedAt: now,
        ttlMs: 10_000,
      },
    ];

    return { report, evidence: Object.freeze(evidence) };
  }

  private _isPidAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  private _isPortOpen(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const sock = new net.Socket();
      const timer = setTimeout(() => { sock.destroy(); resolve(false); }, PORT_PROBE_TIMEOUT_MS);
      sock.connect(port, "127.0.0.1", () => {
        clearTimeout(timer);
        sock.destroy();
        resolve(true);
      });
      sock.on("error", () => { clearTimeout(timer); resolve(false); });
    });
  }

  private _crashLoopCount(projectId: number): number {
    const cutoff = Date.now() - CRASH_WINDOW_MS;
    return (_restartHistory.get(projectId) ?? []).filter((r) => r.ts > cutoff).length;
  }

  private _readMemoryMb(pid: number): number | null {
    try {
      const out = execSync(`ps -o rss= -p ${pid}`, { timeout: 1000 }).toString().trim();
      const kb = parseInt(out, 10);
      return isNaN(kb) ? null : Math.round(kb / 1024);
    } catch {
      return null;
    }
  }

  private _readUptimeMs(pid: number): number {
    try {
      const out = execSync(`ps -o etimes= -p ${pid}`, { timeout: 1000 }).toString().trim();
      const secs = parseInt(out, 10);
      return isNaN(secs) ? 0 : secs * 1000;
    } catch {
      return 0;
    }
  }
}
