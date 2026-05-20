/**
 * runtime-store/runtime-store.ts
 *
 * THE SINGLE SOURCE OF TRUTH for aggregated runtime state.
 *
 * Combines:
 *   - processRegistry (pid, port, process status)
 *   - PreviewLifecycleManager (phase, message, transition history)
 *   - runtimeRecovery (crash count, recovery state)
 *   - lastActivity timestamps (from bus console.log events)
 *
 * Consumers call RuntimeStore.get(projectId) instead of reading four
 * separate registries. RuntimeStore emits "runtime.sync" on the bus
 * whenever state changes so any listener can react.
 *
 * Must be initialized after processRegistry.init() (main.ts boot sequence).
 */

import { bus }                from "../../events/bus.ts";
import { runtimeManager }     from "../runtime-manager.ts";
import { getLifecycleManager } from "../../../preview/lifecycle/preview-lifecycle.manager.ts";
import { runtimeRecovery }    from "./runtime-recovery.ts";
import { RuntimeStateMachine } from "./runtime-state-machine.ts";
import type { RuntimeSnapshot, RuntimePhase } from "./runtime-types.ts";

// ─── Internal record ──────────────────────────────────────────────────────────

interface StoreEntry {
  machine:      RuntimeStateMachine;
  message:      string;
  lastActivity: number;
  crashCount:   number;
  crashReason?: string;
}

// ─── Store ────────────────────────────────────────────────────────────────────

class RuntimeStore {
  private entries = new Map<number, StoreEntry>();
  private initialized = false;

  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    // Track stdout/stderr activity per project
    bus.on("console.log", (e) => {
      const entry = this.getOrCreate(e.projectId);
      entry.lastActivity = Date.now();
    });

    // React to process lifecycle events (agent.event phase=runtime)
    bus.on("agent.event", (e) => {
      if (e.phase !== "runtime") return;
      const pid = e.projectId;
      const pl  = e.payload as Record<string, unknown>;

      switch (e.eventType) {
        case "process.started":
          this.transition(pid, "starting", "Process starting…");
          break;
        case "process.crashed":
          this.crash(pid, String(pl?.["error"] ?? "Process exited unexpectedly."));
          break;
        case "process.stopped":
          this.transition(pid, "idle", "Process stopped.");
          break;
        case "process.restarted":
          this.transition(pid, "restarting", "Restarting…");
          break;
      }
    });

    // React to runtime observation (healthy = ready, crashed = crashed)
    bus.on("runtime.observation", (e) => {
      if (e.status === "healthy") this.transition(e.projectId, "ready", `Server ready on port ${e.port ?? "?"}.`);
      if (e.status === "crashed")  this.crash(e.projectId, e.recentErrors[0] ?? "Crashed.");
    });

    console.log("[runtime-store] Initialized — single source of truth active.");
  }

  /** Get the full aggregated snapshot for a project. */
  get(projectId: number): RuntimeSnapshot {
    const entry     = this.getOrCreate(projectId);
    const procEntry = runtimeManager.get(projectId);
    const lifecycle = getLifecycleManager(projectId).getState();
    const now       = Date.now();
    const recovery  = runtimeRecovery.getEntry(projectId);
    const port      = procEntry?.port;

    return {
      projectId,
      phase:         entry.machine.current(),
      message:       entry.message,
      ts:            now,
      pid:           procEntry?.pid,
      port,
      command:       procEntry?.command,
      startedAt:     procEntry?.startedAt,
      uptimeMs:      procEntry ? now - procEntry.startedAt : undefined,
      restartCount:  procEntry?.restartCount ?? (recovery?.retries ?? 0),
      processStatus: procEntry?.status as RuntimeSnapshot["processStatus"],
      lastActivity:  entry.lastActivity,
      healthy:       lifecycle === "ready" || lifecycle === "verifying",
      crashReason:   entry.crashReason,
      crashCount:    entry.crashCount,
      previewUrl:    port ? runtimeManager.previewUrl(projectId, port) : undefined,
    };
  }

  /** Get snapshots for all tracked projects. */
  all(): RuntimeSnapshot[] {
    return Array.from(this.entries.keys()).map(id => this.get(id));
  }

  /** Force a phase transition and emit runtime.sync. */
  transition(projectId: number, phase: RuntimePhase, message: string): void {
    const entry = this.getOrCreate(projectId);
    const prev  = entry.machine.current();
    const ok    = entry.machine.transition(phase);
    if (!ok) return;
    entry.message = message;
    this.broadcastSync(projectId, prev, phase);
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  private crash(projectId: number, reason: string): void {
    const entry = this.getOrCreate(projectId);
    const prev  = entry.machine.current();
    entry.machine.force("crashed");
    entry.crashReason = reason;
    entry.crashCount++;
    entry.message = reason;
    this.broadcastSync(projectId, prev, "crashed");
  }

  private getOrCreate(projectId: number): StoreEntry {
    if (!this.entries.has(projectId)) {
      this.entries.set(projectId, {
        machine:      new RuntimeStateMachine(projectId),
        message:      "Idle.",
        lastActivity: Date.now(),
        crashCount:   0,
      });
    }
    return this.entries.get(projectId)!;
  }

  private broadcastSync(projectId: number, from: RuntimePhase, to: RuntimePhase): void {
    bus.emit("runtime.sync", {
      projectId,
      snapshot:   this.get(projectId),
      transition: { from, to, message: this.entries.get(projectId)!.message, ts: Date.now() },
    });
  }
}

export const runtimeStore = new RuntimeStore();
