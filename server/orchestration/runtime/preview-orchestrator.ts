/**
 * preview-orchestrator.ts
 *
 * Orchestrates the preview lifecycle within the orchestration layer.
 * Bridges the preview pipeline's lifecycle manager with orchestration events.
 */

import { bus }                          from "../../infrastructure/events/bus.ts";
import { runtimeStore }                 from "../../infrastructure/runtime/runtime-store/runtime-store.ts";
import { waitForRuntimeReady }          from "../execution/runtime-sync.ts";
import { verificationBridge }           from "../agents/verification-bridge.ts";
import { recordSpanStart, recordSpanEnd } from "../telemetry/orchestration-trace.ts";
import { incrementCounter }             from "../telemetry/orchestration-metrics.ts";
import { emitOrchestrationLifecycle }   from "../core/orchestration-events.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PreviewReadyResult {
  projectId:   number;
  port:        number;
  previewUrl:  string;
  verified:    boolean;
  verifyScore: number;
}

export type PreviewLifecycleState =
  | "idle" | "starting" | "ready" | "verifying" | "crashed" | "stopping";

// ── Orchestrator ─────────────────────────────────────────────────────────────

class PreviewOrchestrator {
  private _stateHandlers = new Map<number, Set<(s: PreviewLifecycleState) => void>>();

  // ── Wait for preview ready + optional verify ────────────────────────────────

  async awaitPreviewReady(opts: {
    runId:     string;
    projectId: number;
    verify?:   boolean;
    timeoutMs?: number;
  }): Promise<PreviewReadyResult> {
    const { runId, projectId } = opts;
    const spanId = recordSpanStart(runId, "preview.awaitReady", {
      projectId: String(projectId),
      verify:    String(!!opts.verify),
    });

    try {
      const { port } = await waitForRuntimeReady(projectId, opts.timeoutMs ?? 60_000);
      const snapshot  = runtimeStore.get(projectId);
      const previewUrl = snapshot.previewUrl ?? `http://localhost:${port}`;

      let verified    = false;
      let verifyScore = 0;

      if (opts.verify) {
        const vResult = await verificationBridge.verify({
          runId,
          projectId,
          port,
          checks: ["port_open", "runtime_healthy", "http_200"],
        });
        verified    = vResult.success;
        verifyScore = vResult.data?.score ?? 0;
      }

      // Emit preview.lifecycle event
      bus.emit("preview.lifecycle", {
        projectId,
        state:     "ready",
        prevState: "starting",
        message:   `Preview ready on port ${port ?? "?"}${verified ? " (verified)" : ""}`,
        meta:      { port, verified, verifyScore },
        ts:        Date.now(),
      });

      incrementCounter("preview.ready", { projectId: String(projectId) });
      recordSpanEnd(spanId, "ok");

      return {
        projectId,
        port:        port ?? 0,
        previewUrl,
        verified,
        verifyScore,
      };

    } catch (err) {
      bus.emit("preview.lifecycle", {
        projectId,
        state:     "crashed",
        prevState: "starting",
        message:   String(err),
        ts:        Date.now(),
      });
      incrementCounter("preview.failed", { projectId: String(projectId) });
      recordSpanEnd(spanId, "error");
      throw err;
    }
  }

  // ── Get current preview state ────────────────────────────────────────────────

  getPreviewState(projectId: number): PreviewLifecycleState {
    const snap = runtimeStore.get(projectId);
    switch (snap.phase) {
      case "starting":   return "starting";
      case "ready":      return "ready";
      case "crashed":    return "crashed";
      case "restarting": return "starting";
      case "idle":       return "idle";
      default:           return "idle";
    }
  }

  // ── Subscribe to preview lifecycle ──────────────────────────────────────────

  onPreviewStateChange(
    projectId: number,
    handler:   (state: PreviewLifecycleState) => void,
  ): () => void {
    if (!this._stateHandlers.has(projectId)) {
      this._stateHandlers.set(projectId, new Set());
    }
    this._stateHandlers.get(projectId)!.add(handler);

    return () => {
      this._stateHandlers.get(projectId)?.delete(handler);
    };
  }

  // ── Init bus integration ────────────────────────────────────────────────────

  init(): void {
    bus.subscribe("preview.lifecycle", (e) => {
      const handlers = this._stateHandlers.get(e.projectId);
      if (!handlers) return;
      handlers.forEach(h => {
        try { h(e.state as PreviewLifecycleState); }
        catch {}
      });
    });

    bus.subscribe("runtime.sync", (e) => {
      const state = this.getPreviewState(e.projectId);
      const handlers = this._stateHandlers.get(e.projectId);
      if (!handlers) return;
      handlers.forEach(h => { try { h(state); } catch {} });
    });

    console.log("[preview-orchestrator] Preview lifecycle integration active.");
  }
}

export const previewOrchestrator = new PreviewOrchestrator();
