/**
 * process-registry.ts
 *
 * SINGLE SOURCE OF TRUTH for all runtime processes.
 *
 * Responsibilities:
 *   - Dynamic free-port allocation (no collisions, no modulo math)
 *   - Persistent state snapshot (survives dev-server hot-reload)
 *   - Startup reconciliation (audit what was alive before restart)
 *   - Periodic health monitoring (detect crashes between ticks)
 *   - Graceful shutdown (flush state + SIGKILL all children)
 *
 * Consumed by:
 *   server-lifecycle-tools, runtime.routes, preview-proxy,
 *   publishing.routes, preview-tools
 *
 * init() MUST be called once at server startup (see main.ts).
 * shutdown() MUST be called on SIGTERM/SIGINT (see main.ts).
 */

import { spawn } from "child_process";
import net from "net";
import { bus } from "../events/bus.ts";
import {
  loadPersistedEntries,
  saveEntries,
  clearPersistedState,
  toPersistedEntry,
} from "./process-persistence.ts";
import { reconcileOnStartup } from "./process-recovery.ts";
import { startHealthMonitor, type HealthMonitor } from "./process-health.ts";
import type {
  ProcessEntry,
  ProcessStatus,
  StartOptions,
  StartResult,
} from "./process-types.ts";

export type { ProcessStatus, ProcessEntry, StartOptions, StartResult };

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_LOGS = 200;

// ─── Port allocation ──────────────────────────────────────────────────────────

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address() as net.AddressInfo;
      srv.close(() => resolve(addr.port));
    });
    srv.on("error", reject);
  });
}

// ─── Event bus helper ─────────────────────────────────────────────────────────

function emitProcessEvent(type: string, projectId: number, payload: unknown): void {
  bus.emit("agent.event", {
    runId: `runtime-${projectId}`,
    projectId,
    phase: "runtime",
    eventType: type as any,
    payload,
    ts: Date.now(),
  });
}

// ─── Registry ─────────────────────────────────────────────────────────────────

class ProcessRegistry {
  private entries = new Map<number, ProcessEntry>();
  private monitor: HealthMonitor | null = null;
  private saveTimer: NodeJS.Timeout | null = null;
  private initialized = false;

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  /** Call once at server startup. Loads persisted state + starts health monitor. */
  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    const persisted = await loadPersistedEntries();
    const { cleaned } = reconcileOnStartup(persisted);

    // Load reconciled (dead) entries as reference — no ChildProcess to attach
    for (const p of cleaned) {
      if (p.status === "running") {
        // Rare: process truly survived — add a shell entry so getPort() works
        // (no stdio — we can't reattach to the streams of a detached proc)
        const syntheticProc = { pid: p.pid, kill: () => {} } as any;
        this.entries.set(p.projectId, {
          ...p,
          process: syntheticProc,
          logs: [`[recovered] Process ${p.pid} survived restart`],
        });
      }
      // Dead entries are intentionally NOT loaded — they'd show wrong status
    }

    // Persist cleaned state immediately so a second restart sees correct data
    await this.flushToDisk();

    this.monitor = startHealthMonitor(
      () => Array.from(this.entries.values()).map(e => ({
        projectId: e.projectId, pid: e.pid, status: e.status,
      })),
      {
        onCrash: (projectId, pid) => {
          console.warn(`[process-registry] Health check: project ${projectId} pid ${pid} is dead`);
          this.setStatus(projectId, "crashed");
          emitProcessEvent("process.crashed", projectId, { pid, source: "health-monitor" });
          this.scheduleSave();
        },
        onHeartbeat: (projectId) => {
          const e = this.entries.get(projectId);
          if (e) {
            this.entries.set(projectId, { ...e, lastHeartbeat: Date.now() });
          }
        },
      }
    );

    console.log("[process-registry] Initialized — health monitor started");
  }

  /** Call on SIGTERM/SIGINT. Flushes state then kills all children. */
  async shutdown(): Promise<void> {
    this.monitor?.stop();
    if (this.saveTimer) clearTimeout(this.saveTimer);
    await this.flushToDisk();

    for (const [id, entry] of this.entries) {
      if (entry.status === "running" || entry.status === "starting") {
        try { entry.process.kill("SIGKILL"); } catch {}
        this.setStatus(id, "stopped");
      }
    }

    // If nothing is running, clear the file for a clean next boot
    const anyRunning = Array.from(this.entries.values()).some(
      e => e.status === "running" || e.status === "starting"
    );
    if (!anyRunning) await clearPersistedState();

    console.log("[process-registry] Shutdown complete");
  }

  // ── Process management ─────────────────────────────────────────────────────

  async start(opts: StartOptions): Promise<StartResult> {
    const { projectId, cwd, env } = opts;
    const command = opts.command ?? "npm run dev";

    const existing = this.entries.get(projectId);
    if (existing && (existing.status === "running" || existing.status === "starting")) {
      return { ok: true, alreadyRunning: true, port: existing.port, pid: existing.pid };
    }

    let port: number;
    try {
      port = await findFreePort();
    } catch {
      return { ok: false, error: "Could not allocate a free port" };
    }

    const logs: string[] = [];
    const restartCount = (existing?.restartCount ?? 0);

    // Use shell:true so quoted args and compound commands work correctly.
    // e.g. "npm run dev -- --port 3000" or "python -c 'print(1)'"
    const proc = spawn(command, {
      cwd,
      env: { ...process.env, PORT: String(port), NODE_ENV: "development", ...env },
      shell: true,
      detached: false,
    } as any);

    if (!proc.pid) return { ok: false, error: "Failed to spawn process — no PID" };

    const entry: ProcessEntry = {
      projectId, pid: proc.pid, port, status: "starting",
      process: proc, logs, startedAt: Date.now(),
      command, cwd, restartCount, lastHeartbeat: Date.now(),
    };
    this.entries.set(projectId, entry);

    proc.stdout?.on("data", (d: Buffer) => {
      const line = d.toString().trimEnd();
      logs.push(line);
      if (logs.length > MAX_LOGS) logs.shift();
      bus.emit("console.log", { projectId, stream: "stdout", line, ts: Date.now() });
      this.setStatus(projectId, "running");
    });

    proc.stderr?.on("data", (d: Buffer) => {
      const line = d.toString().trimEnd();
      logs.push(`[stderr] ${line}`);
      if (logs.length > MAX_LOGS) logs.shift();
      bus.emit("console.log", { projectId, stream: "stderr", line, ts: Date.now() });
    });

    proc.on("exit", (code) => {
      const crashed = code !== 0 && code !== null;
      this.setStatus(projectId, crashed ? "crashed" : "stopped");
      emitProcessEvent(crashed ? "process.crashed" : "process.stopped", projectId, { code, port });
      this.scheduleSave();
      setTimeout(() => this.entries.delete(projectId), 3_000);
    });

    proc.on("error", (err) => {
      this.setStatus(projectId, "crashed");
      emitProcessEvent("process.crashed", projectId, { error: err.message });
      this.scheduleSave();
    });

    emitProcessEvent("process.started", projectId, { pid: proc.pid, port, command });
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
          this.entries.delete(projectId);
          this.scheduleSave();
        }
      }, 5_000);
      this.setStatus(projectId, "stopped");
      emitProcessEvent("process.stopped", projectId, { port: entry.port });
      this.scheduleSave();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  async restart(opts: StartOptions): Promise<StartResult> {
    this.stop(opts.projectId);
    await new Promise(r => setTimeout(r, 600));
    const result = await this.start({
      ...opts,
      // Carry restart count forward
    });
    if (result.ok) {
      const e = this.entries.get(opts.projectId);
      if (e) this.entries.set(opts.projectId, { ...e, restartCount: e.restartCount + 1 });
      emitProcessEvent("process.restarted", opts.projectId, { port: result.port });
      this.scheduleSave();
    }
    return result;
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  get(projectId: number): ProcessEntry | undefined {
    return this.entries.get(projectId);
  }

  getPort(projectId: number): number | undefined {
    const e = this.entries.get(projectId);
    return e?.status === "running" || e?.status === "starting" ? e.port : undefined;
  }

  isRunning(projectId: number): boolean {
    const s = this.entries.get(projectId)?.status;
    return s === "running" || s === "starting";
  }

  getLogs(projectId: number, tail = 50): string[] {
    return this.entries.get(projectId)?.logs.slice(-tail) ?? [];
  }

  remove(projectId: number): void {
    this.entries.delete(projectId);
    this.scheduleSave();
  }

  all(): ProcessEntry[] {
    return Array.from(this.entries.values());
  }

  // ── Internal helpers ───────────────────────────────────────────────────────

  private setStatus(projectId: number, status: ProcessStatus): void {
    const e = this.entries.get(projectId);
    if (e) this.entries.set(projectId, { ...e, status });
  }

  /** Debounced disk save — coalesces rapid mutations into one write. */
  private scheduleSave(): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(async () => {
      this.saveTimer = null;
      await this.flushToDisk();
    }, 500);
  }

  private async flushToDisk(): Promise<void> {
    const persisted = Array.from(this.entries.values()).map(toPersistedEntry);
    await saveEntries(persisted);
  }
}

export const processRegistry = new ProcessRegistry();
