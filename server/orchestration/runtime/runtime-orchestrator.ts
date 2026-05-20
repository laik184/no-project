/**
 * runtime-orchestrator.ts
 *
 * Orchestrates the full runtime lifecycle for a project within the
 * orchestration layer. Bridges runtimeManager, runtimeStore, and
 * orchestration state machine into a single coordinated flow.
 */

import { runtimeManager }        from "../../infrastructure/runtime/runtime-manager.ts";
import { runtimeStore }          from "../../infrastructure/runtime/runtime-store/runtime-store.ts";
import { watchRuntimeSync, waitForRuntimeReady } from "../execution/runtime-sync.ts";
import { emitOrchestrationLifecycle }            from "../core/orchestration-events.ts";
import { captureCheckpoint }                     from "../core/orchestration-replay.ts";
import { recordSpanStart, recordSpanEnd }        from "../telemetry/orchestration-trace.ts";
import { incrementCounter, recordDuration }      from "../telemetry/orchestration-metrics.ts";
import { bus }                                   from "../../infrastructure/events/bus.ts";
import type { OrchestrationPhase }               from "../core/orchestration-types.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RuntimeStartOpts {
  runId:      string;
  projectId:  number;
  command:    string;
  cwd?:       string;
  env?:       Record<string, string>;
  waitReady?: boolean;
  timeoutMs?: number;
}

export interface RuntimeStopOpts {
  runId:     string;
  projectId: number;
  reason?:   string;
  force?:    boolean;
}

export interface RuntimeStatusResult {
  projectId:    number;
  phase:        string;
  healthy:      boolean;
  port?:        number;
  pid?:         number;
  uptimeMs?:    number;
  crashCount:   number;
  previewUrl?:  string;
}

// ── Orchestrator class ────────────────────────────────────────────────────────

class RuntimeOrchestrator {
  // ── Start project runtime ───────────────────────────────────────────────────

  async startProject(opts: RuntimeStartOpts): Promise<RuntimeStatusResult> {
    const { runId, projectId, command } = opts;
    const t0     = Date.now();
    const spanId = recordSpanStart(runId, "runtime.start", {
      projectId: String(projectId),
      command:   command.slice(0, 60),
    });

    try {
      emitOrchestrationLifecycle({
        runId, projectId,
        phase:   "execute",
        status:  "running",
        mode:    "tool-loop",
        traceId: runId,
      });

      await runtimeManager.start(projectId, {
        command,
        cwd: opts.cwd,
        env: opts.env,
      });

      if (opts.waitReady !== false) {
        await waitForRuntimeReady(projectId, opts.timeoutMs ?? 60_000);
      }

      const snapshot = runtimeStore.get(projectId);

      captureCheckpoint(runId, projectId, "execute");
      incrementCounter("runtime.starts.succeeded", { projectId: String(projectId) });
      recordDuration("runtime.start.duration", Date.now() - t0, { projectId: String(projectId) });
      recordSpanEnd(spanId, "ok");

      return this.toStatusResult(snapshot);

    } catch (err) {
      incrementCounter("runtime.starts.failed", { projectId: String(projectId) });
      recordSpanEnd(spanId, "error");
      throw err;
    }
  }

  // ── Stop project runtime ────────────────────────────────────────────────────

  async stopProject(opts: RuntimeStopOpts): Promise<void> {
    const { runId, projectId, reason, force } = opts;
    const spanId = recordSpanStart(runId, "runtime.stop", {
      projectId: String(projectId),
      reason:    reason ?? "requested",
    });

    try {
      await runtimeManager.stop(projectId, { force });

      bus.emit("agent.event", {
        runId,
        projectId,
        phase:     "runtime",
        agentName: "runtime-orchestrator",
        eventType: "runtime.stopped",
        payload:   { reason },
        ts:        Date.now(),
      });

      incrementCounter("runtime.stops", { projectId: String(projectId) });
      recordSpanEnd(spanId, "ok");

    } catch (err) {
      recordSpanEnd(spanId, "error");
      throw err;
    }
  }

  // ── Restart project runtime ─────────────────────────────────────────────────

  async restartProject(opts: RuntimeStartOpts): Promise<RuntimeStatusResult> {
    const { runId, projectId } = opts;
    const spanId = recordSpanStart(runId, "runtime.restart", { projectId: String(projectId) });

    try {
      await runtimeManager.restart(projectId);

      if (opts.waitReady !== false) {
        await waitForRuntimeReady(projectId, opts.timeoutMs ?? 60_000);
      }

      const snapshot = runtimeStore.get(projectId);
      incrementCounter("runtime.restarts", { projectId: String(projectId) });
      recordSpanEnd(spanId, "ok");
      return this.toStatusResult(snapshot);

    } catch (err) {
      recordSpanEnd(spanId, "error");
      throw err;
    }
  }

  // ── Get runtime status ──────────────────────────────────────────────────────

  getStatus(projectId: number): RuntimeStatusResult {
    const snapshot = runtimeStore.get(projectId);
    return this.toStatusResult(snapshot);
  }

  // ── Watch runtime for a run ─────────────────────────────────────────────────

  watchForRun(
    runId:     string,
    projectId: number,
    handler:   (status: RuntimeStatusResult) => void,
  ): () => void {
    return watchRuntimeSync(projectId, ({ phase, healthy, port }) => {
      const snap = runtimeStore.get(projectId);
      handler(this.toStatusResult(snap));
    });
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  private toStatusResult(snapshot: ReturnType<typeof runtimeStore.get>): RuntimeStatusResult {
    return {
      projectId:   snapshot.projectId,
      phase:       snapshot.phase,
      healthy:     snapshot.healthy,
      port:        snapshot.port,
      pid:         snapshot.pid,
      uptimeMs:    snapshot.uptimeMs,
      crashCount:  snapshot.crashCount,
      previewUrl:  snapshot.previewUrl,
    };
  }
}

export const runtimeOrchestrator = new RuntimeOrchestrator();
