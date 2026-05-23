/**
 * process-registry.ts — single source of truth for all runtime processes.
 *
 * - Dynamic free-port allocation via port-manager (no hardcoded ports)
 * - captureService.attach() wires every spawned process into the intelligence pipeline
 * - 3-second health monitor (process-health.ts)
 * - Persistent state snapshot (survives dev-server hot-reload)
 *
 * Spawn logic extracted to process-registry-spawn.ts (each file ≤250 lines).
 * init() MUST be called once at startup. shutdown() MUST be called on SIGTERM/SIGINT.
 */

import {
  loadPersistedEntries, saveEntries,
  clearPersistedState, toPersistedEntry,
} from "./process-persistence.ts";
import { reconcileOnStartup }   from "./process-recovery.ts";
import { startHealthMonitor, type HealthMonitor } from "./process-health.ts";
import { spawnProcess, emitProcessEvent } from "./process-registry-spawn.ts";
import { spawnLock }            from "./spawn-lock/index.ts";
import type { ProcessEntry, ProcessStatus, StartOptions, StartResult } from "./process-types.ts";

export type { ProcessStatus, ProcessEntry, StartOptions, StartResult };

class ProcessRegistry {
  private entries     = new Map<number, ProcessEntry>();
  private monitor:      HealthMonitor | null = null;
  private saveTimer:    NodeJS.Timeout | null = null;
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    const persisted = await loadPersistedEntries();
    const { cleaned } = reconcileOnStartup(persisted);
    for (const p of cleaned) {
      if (p.status === "running") {
        this.entries.set(p.projectId, {
          ...p, process: { pid: p.pid, kill: () => {} } as any,
          logs: [`[recovered] Process ${p.pid} survived restart`],
          lastActivity: Date.now(),
        });
      }
    }
    await this.flushToDisk();
    this.monitor = startHealthMonitor(
      () => Array.from(this.entries.values()).map(e => ({ projectId: e.projectId, pid: e.pid, status: e.status })),
      {
        onCrash: (projectId, pid) => {
          console.warn(`[process-registry] Health check: project ${projectId} pid ${pid} is dead`);
          this._setStatus(projectId, "crashed");
          emitProcessEvent("process.crashed", projectId, { pid, source: "health-monitor" });
          this._scheduleSave();
        },
        onHeartbeat: (projectId) => {
          const e = this.entries.get(projectId);
          if (e) this.entries.set(projectId, { ...e, lastHeartbeat: Date.now() });
        },
      },
    );
    console.log("[process-registry] Initialized — health monitor started");
  }

  async shutdown(): Promise<void> {
    this.monitor?.stop();
    if (this.saveTimer) clearTimeout(this.saveTimer);
    await this.flushToDisk();
    for (const [id, e] of this.entries) {
      if (e.status === "running" || e.status === "starting") {
        try { e.process.kill("SIGKILL"); } catch {}
        this._setStatus(id, "stopped");
      }
    }
    const anyRunning = Array.from(this.entries.values()).some(e => e.status === "running" || e.status === "starting");
    if (!anyRunning) await clearPersistedState();
    console.log("[process-registry] Shutdown complete");
  }

  /** Spawn under per-project lock — concurrent callers get same promise. */
  async start(opts: StartOptions): Promise<StartResult> {
    return spawnLock.withLock(
      opts.projectId,
      "process-registry",
      () => spawnProcess(opts, this.entries, this._setStatus.bind(this), this._scheduleSave.bind(this)),
    );
  }

  stop(projectId: number): { ok: boolean; error?: string } {
    const entry = this.entries.get(projectId);
    if (!entry) return { ok: true };
    try {
      entry.process.kill("SIGTERM");
      setTimeout(() => {
        if (this.entries.has(projectId)) {
          try { entry.process.kill("SIGKILL"); } catch {}
          this.entries.delete(projectId); this._scheduleSave();
        }
      }, 5_000);
      this._setStatus(projectId, "stopped");
      emitProcessEvent("process.stopped", projectId, { port: entry.port });
      this._scheduleSave();
      return { ok: true };
    } catch (err: any) { return { ok: false, error: err.message }; }
  }

  async restart(opts: StartOptions): Promise<StartResult> {
    this.stop(opts.projectId);
    await new Promise(r => setTimeout(r, 600));
    const result = await this.start(opts);
    if (result.ok) {
      const e = this.entries.get(opts.projectId);
      if (e) this.entries.set(opts.projectId, { ...e, restartCount: e.restartCount + 1 });
      emitProcessEvent("process.restarted", opts.projectId, { port: result.port });
      this._scheduleSave();
    }
    return result;
  }

  get(projectId: number):              ProcessEntry | undefined { return this.entries.get(projectId); }
  getPort(projectId: number):          number | undefined       { const e = this.entries.get(projectId); return (e?.status === "running" || e?.status === "starting") ? e.port : undefined; }
  isRunning(projectId: number):        boolean                  { const s = this.entries.get(projectId)?.status; return s === "running" || s === "starting"; }
  getLogs(projectId: number, tail=50): string[]                 { return this.entries.get(projectId)?.logs.slice(-tail) ?? []; }
  remove(projectId: number):           void                     { this.entries.delete(projectId); this._scheduleSave(); }
  all():                               ProcessEntry[]           { return Array.from(this.entries.values()); }

  private _setStatus(p: number, s: ProcessStatus): void { const e = this.entries.get(p); if (e) this.entries.set(p, { ...e, status: s }); }
  private _scheduleSave(): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(async () => { this.saveTimer = null; await this.flushToDisk(); }, 500);
  }
  private async flushToDisk(): Promise<void> {
    await saveEntries(Array.from(this.entries.values()).map(toPersistedEntry));
  }
}

export const processRegistry = new ProcessRegistry();
