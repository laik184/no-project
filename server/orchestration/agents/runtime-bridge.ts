/**
 * runtime-bridge.ts
 *
 * Typed bridge between the orchestration engine and the RuntimeAgent.
 * Routes runtime observation requests and exposes health signals to
 * the orchestration layer for gating and recovery decisions.
 */

import { observeRuntime }         from "../../agents/runtime/runtime-agent.ts";
import { emitAgentCoordination }  from "../core/orchestration-events.ts";
import { recordSpanStart, recordSpanEnd } from "../telemetry/orchestration-trace.ts";
import { incrementCounter, recordDuration } from "../telemetry/orchestration-metrics.ts";
import type { BridgeResult }      from "../core/orchestration-types.ts";
import type {
  RuntimeObservationResult,
  RuntimeObservationTrigger,
} from "../../agents/runtime/types.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RuntimeObserveInput {
  runId:        string;
  projectId:    number;
  trigger?:     RuntimeObservationTrigger;
  includePorts?: boolean;
  includeLog?:  boolean;
}

// ── Bridge ────────────────────────────────────────────────────────────────────

class RuntimeBridge {
  async observe(
    input: RuntimeObserveInput,
  ): Promise<BridgeResult<RuntimeObservationResult>> {
    const { runId, projectId } = input;
    const t0     = Date.now();
    const spanId = recordSpanStart(runId, "runtime.observe", {
      projectId: String(projectId),
      trigger:   input.trigger ?? "manual",
    });

    try {
      emitAgentCoordination({
        runId,
        projectId,
        agentName: "runtime-agent",
        role:      "runtime",
        outcome:   "success",
        phase:     "verify",
      });

      const result = await observeRuntime({
        projectId,
        runId,
        trigger:      input.trigger ?? "manual",
        includePorts: input.includePorts ?? true,
        includeLog:   input.includeLog ?? false,
      });

      const healthy = result.status === "healthy";

      incrementCounter(
        healthy ? "runtime.observe.healthy" : "runtime.observe.degraded",
        { projectId: String(projectId) },
      );
      recordDuration("runtime.observe.duration", Date.now() - t0, {
        projectId: String(projectId),
      });
      recordSpanEnd(spanId, healthy ? "ok" : "error");

      return {
        success:    healthy,
        data:       result,
        durationMs: Date.now() - t0,
        retryable:  !healthy && result.status !== "crashed",
      };

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[runtime-bridge] Observation failed: ${msg}`);
      incrementCounter("runtime.observe.error", { projectId: String(projectId) });
      recordSpanEnd(spanId, "error");
      return { success: false, error: msg, durationMs: Date.now() - t0, retryable: true };
    }
  }

  /** Convenience: return true if runtime is healthy right now. */
  async isHealthy(projectId: number, runId: string): Promise<boolean> {
    const result = await this.observe({ projectId, runId, trigger: "scheduled" });
    return result.success && result.data?.status === "healthy";
  }
}

export const runtimeBridge = new RuntimeBridge();
