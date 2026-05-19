/**
 * process-registry.ts — single source of truth for all runtime processes.
 *
 * - Dynamic free-port allocation via port-manager (no hardcoded ports)
 * - captureService.attach() wires every spawned process into the intelligence pipeline
 * - 3-second health monitor (process-health.ts)
 * - Persistent state snapshot (survives dev-server hot-reload)
 *
 * init() MUST be called once at startup.  shutdown() MUST be called on SIGTERM/SIGINT.
 */

import { spawn } from "child_process";
import { bus } from "../events/bus.ts";
import { findFreePort } from "../runtime/port-manager.ts";
import { captureService } from "../../console/capture/capture.service.ts";
import {
  loadPersistedEntries, saveEntries,
  clearPersistedState, toPersistedEntry,
} from "./process-persistence.ts";
import { reconcileOnStartup } from "./process-recovery.ts";
import { startHealthMonitor, type HealthMonitor } from "./process-health.ts";
import type { ProcessEntry, ProcessStatus, StartOptions, StartResult } from "./process-types.ts";

export type { ProcessStatus, ProcessEntry, StartOptions, StartResult };

const MAX_LOGS = 200;

function emit(type: string, projectId: number, payload: unknown): void {
  bus.emit("agent.event", {
    runId: `runtime-${projectId}`, projectId,
    phase: "runtime", eventType: type as any, payload, ts: Date.now(),
  });
}

class ProcessRegistry {
  private entries = new Map<number, ProcessEntry>();
  private monitor: HealthMonitor | null = null;
  private saveTimer: NodeJS.Timeout | null = null;
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
          this.setStatus(projectId, "crashed");
          emit("process.crashed", projectId, { pid, source: "health-monitor" });
          this.scheduleSave();
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
        this.setStatus(id, "stopped");
      }
    }
    const anyRunning = Array.from(this.entries.values()).some(e => e.status === "running" || e.status === "starting");
    if (!anyRunning) await clearPersistedState();
    console.log("[process-registry] Shutdown complete");
  }

  async start(opts: StartOptions): Promise<StartResult> {
    const { projectId, cwd, env } = opts;
    const command = opts.command ?? "npm run dev";

    const existing = this.entries.get(projectId);
    if (existing && (existing.status === "running" || existing.status === "starting"))
      return { ok: true, alreadyRunning: true, port: existing.port, pid: existing.pid };

    let port: number;
    try { port = await findFreePort(); }
    catch { return { ok: false, error: "Could not allocate a free port" }; }

    const logs: string[] = [];
    const proc = spawn(command, {
      cwd, shell: true, detached: false,
      env: { ...process.env, PORT: String(port), NODE_ENV: "development", ...env },
    } as any);

    if (!proc.pid) return { ok: false, error: "Failed to spawn process — no PID" };

    const now = Date.now();
    this.entries.set(projectId, {
      projectId, pid: proc.pid, port, status: "starting",
      process: proc, logs, startedAt: now,
      command, cwd, restartCount: existing?.restartCount ?? 0,
      lastHeartbeat: now, lastActivity: now,
    });

    // Wire through intelligence pipeline (Path A — captureService → console orchestrator)
    if (proc.stdout && proc.stderr) {
      captureService.attach({ processId: `project-${projectId}-${proc.pid}`, projectId, stdout: proc.stdout, stderr: proc.stderr });
    }

    const updateActivity = () => {
      const e = this.entries.get(projectId);
      if (e) this.entries.set(projectId, { ...e, lastActivity: Date.now() });
    };

    proc.stdout?.on("data", (d: Buffer) => {
      const line = d.toString().trimEnd();
      logs.push(line); if (logs.length > MAX_LOGS) logs.shift();
      updateActivity();
      bus.emit("console.log", { projectId, stream: "stdout", line, ts: Date.now() });
      if (this.entries.get(projectId)?.status === "starting") this.setStatus(projectId, "running");
    });

    proc.stderr?.on("data", (d: Buffer) => {
      const line = d.toString().trimEnd();
      logs.push(`[stderr] ${line}`); if (logs.length > MAX_LOGS) logs.shift();
      updateActivity();
      bus.emit("console.log", { projectId, stream: "stderr", line, ts: Date.now() });
    });

    proc.on("exit", (code) => {
      const crashed = code !== 0 && code !== null;
      this.setStatus(projectId, crashed ? "crashed" : "stopped");
      emit(crashed ? "process.crashed" : "process.stopped", projectId, { code, port });
      this.scheduleSave();
      setTimeout(() => this.entries.delete(projectId), 3_000);
    });

    proc.on("error", (err) => {
      this.setStatus(projectId, "crashed");
      emit("process.crashed", projectId, { error: err.message });
      this.scheduleSave();
    });

    emit("process.started", projectId, { pid: proc.pid, port, command });
    this.scheduleSave();
    return { ok: true, pid: proc.pid, port };
  }

  stop(projectId: number): { ok: boolean; error?: string } {
    const entry = this.entries.get(projectId);
    if (!entry) return { ok: true };
    try {
      entry.process.kill("SIGTERM");
      setTimeout(() => {
        if (this.entries.has(projectId)) {
          try { entry.process.kill("SIGKILL"); } catch {}
          this.entries.delete(projectId); this.scheduleSave();
        }
      }, 5_000);
      this.setStatus(projectId, "stopped");
      emit("process.stopped", projectId, { port: entry.port });
      this.scheduleSave();
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
      emit("process.restarted", opts.projectId, { port: result.port });
      this.scheduleSave();
    }
    return result;
  }

  get(projectId: number):              ProcessEntry | undefined { return this.entries.get(projectId); }
  getPort(projectId: number):          number | undefined       { const e = this.entries.get(projectId); return (e?.status === "running" || e?.status === "starting") ? e.port : undefined; }
  isRunning(projectId: number):        boolean                  { const s = this.entries.get(projectId)?.status; return s === "running" || s === "starting"; }
  getLogs(projectId: number, tail=50): string[]                 { return this.entries.get(projectId)?.logs.slice(-tail) ?? []; }
  remove(projectId: number):           void                     { this.entries.delete(projectId); this.scheduleSave(); }
  all():                               ProcessEntry[]           { return Array.from(this.entries.values()); }

  private setStatus(projectId: number, status: ProcessStatus): void {
    const e = this.entries.get(projectId);
    if (e) this.entries.set(projectId, { ...e, status });
  }
  private scheduleSave(): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(async () => { this.saveTimer = null; await this.flushToDisk(); }, 500);
  }
  private async flushToDisk(): Promise<void> {
    await saveEntries(Array.from(this.entries.values()).map(toPersistedEntry));
  }
}

export const processRegistry = new ProcessRegistry();
