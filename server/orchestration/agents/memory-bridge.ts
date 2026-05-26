/**
 * memory-bridge.ts
 * Memory agent removed — uses memory pipeline directly.
 */

import { observe }               from "../../memory/pipeline/memory-pipeline.ts";
import { injectMemoryContext }   from "../../memory/injection/memory-injector.ts";
import { emitAgentCoordination } from "../core/orchestration-events.ts";
import { recordSpanStart, recordSpanEnd } from "../telemetry/orchestration-trace.ts";
import { incrementCounter }      from "../telemetry/orchestration-metrics.ts";
import { memoryTelemetry }       from "../../memory/telemetry/memory-telemetry.ts";
import type { BridgeResult }     from "../core/orchestration-types.ts";

export interface MemoryContextInput  { runId: string; projectId: number; goal: string; phase?: string; }
export interface ReflectionInput     { runId: string; projectId: number; goal: string; outcome: "success" | "failure" | "partial"; durationMs: number; score?: number; notes?: string; messages?: Array<{ role: string; content: string }>; }
export interface FailureMemoryInput  { runId: string; projectId: number; goal: string; errorType: string; errorDetail: string; fixAttempt?: string; resolved: boolean; }

class MemoryBridge {
  async loadContextForPlanning(input: MemoryContextInput): Promise<BridgeResult<string>> {
    const { runId, projectId, goal } = input;
    const phase  = input.phase ?? "planning";
    const t0     = Date.now();
    const spanId = recordSpanStart(runId, "memory.load", { projectId: String(projectId), phase });

    try {
      emitAgentCoordination({ runId, projectId, agentName: "memory", role: "context-provider", outcome: "success", phase: "plan" });

      const injection = await injectMemoryContext({ query: goal, projectId, runId, phase }).catch(() => null);
      const injectedChars = injection?.totalChars ?? 0;

      if (injectedChars > 0) {
        memoryTelemetry.injected({ runId, projectId, blockCount: injection?.blockCount ?? 0, totalChars: injectedChars, phase });
      }

      incrementCounter("memory.context.loaded", { projectId: String(projectId) });
      recordSpanEnd(spanId, "ok");
      return { success: true, data: injection?.context ?? "", durationMs: Date.now() - t0, retryable: false };

    } catch (err) {
      memoryTelemetry.failed({ operation: "loadContext", projectId, reason: String(err), runId });
      recordSpanEnd(spanId, "error");
      return { success: true, data: "", durationMs: Date.now() - t0, retryable: false };
    }
  }

  async saveRunSummary(input: ReflectionInput): Promise<BridgeResult<void>> {
    const { runId, projectId, goal, outcome, notes } = input;
    const t0 = Date.now();
    try {
      if (outcome === "failure" && notes) {
        observe({ content: `Failed run: "${goal.slice(0, 120)}" — ${notes.slice(0, 400)}`, projectId, runId, hint: { success: false } }).catch(() => {});
      }
      emitAgentCoordination({ runId, projectId, agentName: "memory", role: "memory-writer", outcome: "success", phase: "learn" });
      memoryTelemetry.updated({ entryId: runId, category: "run-summary", projectId, field: "outcome" });
      incrementCounter("memory.summary.saved", { projectId: String(projectId), outcome });
      return { success: true, durationMs: Date.now() - t0, retryable: false };
    } catch (err) {
      return { success: false, error: String(err), durationMs: Date.now() - t0, retryable: false };
    }
  }

  async saveFailureMemory(input: FailureMemoryInput): Promise<void> {
    const { runId, projectId, goal, errorType, errorDetail, fixAttempt, resolved } = input;
    const content = [`Failure [${errorType}]: "${goal.slice(0, 120)}"`, `Error: ${errorDetail.slice(0, 400)}`, fixAttempt ? `Fix attempt: ${fixAttempt.slice(0, 300)}` : null, `Resolved: ${resolved ? "yes" : "no"}`].filter(Boolean).join("\n");
    await observe({ content, projectId, runId, hint: { success: resolved } }).catch(() => {});
  }

  async loadContextForRecovery(input: MemoryContextInput): Promise<BridgeResult<string>> {
    return this.loadContextForPlanning({ ...input, phase: "recovery" });
  }

  async loadContextForVerification(input: MemoryContextInput): Promise<BridgeResult<string>> {
    return this.loadContextForPlanning({ ...input, phase: "verification" });
  }

  async trackTaskOutcome(_opts: { runId: string; projectId: number; goal: string; success: boolean }): Promise<void> {}
}

export const memoryBridge = new MemoryBridge();
