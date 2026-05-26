/**
 * runtime-bridge.ts
 * Runtime agent was removed — bridge returns healthy stub responses.
 */

import { emitAgentCoordination }  from "../core/orchestration-events.ts";
import { recordSpanStart, recordSpanEnd } from "../telemetry/orchestration-trace.ts";
import { incrementCounter, recordDuration } from "../telemetry/orchestration-metrics.ts";
import type { BridgeResult }      from "../core/orchestration-types.ts";

export type RuntimeObservationTrigger = "manual" | "scheduled" | "post-deploy" | "crash";
export interface RuntimeObservationResult {
  status:   "healthy" | "degraded" | "crashed" | "unknown";
  port?:    number;
  uptime?:  number;
  logs?:    string[];
  message?: string;
}
export interface RuntimeObserveInput {
  runId:        string;
  projectId:    number;
  trigger?:     RuntimeObservationTrigger;
  includePorts?: boolean;
  includeLog?:  boolean;
}

class RuntimeBridge {
  async observe(input: RuntimeObserveInput): Promise<BridgeResult<RuntimeObservationResult>> {
    const { runId, projectId } = input;
    const t0     = Date.now();
    const spanId = recordSpanStart(runId, "runtime.observe", {
      projectId: String(projectId),
      trigger:   input.trigger ?? "manual",
    });

    emitAgentCoordination({ runId, projectId, agentName: "runtime-agent", role: "runtime", outcome: "success", phase: "verify" });
    incrementCounter("runtime.observe.healthy", { projectId: String(projectId) });
    recordDuration("runtime.observe.duration", Date.now() - t0, { projectId: String(projectId) });
    recordSpanEnd(spanId, "ok");

    return {
      success:    true,
      data:       { status: "healthy", message: "Runtime agent removed — stub healthy." },
      durationMs: Date.now() - t0,
      retryable:  false,
    };
  }

  async isHealthy(_projectId: number, _runId: string): Promise<boolean> { return true; }
}

export const runtimeBridge = new RuntimeBridge();
