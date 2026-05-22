/**
 * memory-bridge.ts
 *
 * Typed bridge between the orchestration engine and the memory/reflection systems.
 * Injects semantic context into planning, recovery, and verification prompts.
 *
 * UPDATED:
 * - loadContextForPlanning now uses semantically enhanced context (vector + file)
 * - saveRunSummary also feeds the pipeline + emits memory.injected telemetry
 * - saveFailureMemory: new dedicated method for structured failure storage
 * - All operations emit proper memory telemetry events
 */

import { MemoryManager }        from "../../agents/memory/index.ts";
import { injectMemoryContext }  from "../../memory/injection/memory-injector.ts";
import { observe }              from "../../memory/pipeline/memory-pipeline.ts";
import { emitAgentCoordination } from "../core/orchestration-events.ts";
import { recordSpanStart, recordSpanEnd } from "../telemetry/orchestration-trace.ts";
import { incrementCounter }     from "../telemetry/orchestration-metrics.ts";
import { memoryTelemetry }      from "../../memory/telemetry/memory-telemetry.ts";
import type { BridgeResult }    from "../core/orchestration-types.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MemoryContextInput {
  runId:     string;
  projectId: number;
  goal:      string;
  phase?:    string;
}

export interface ReflectionInput {
  runId:      string;
  projectId:  number;
  goal:       string;
  outcome:    "success" | "failure" | "partial";
  durationMs: number;
  score?:     number;
  notes?:     string;
  messages?:  Array<{ role: string; content: string }>;
}

export interface FailureMemoryInput {
  runId:       string;
  projectId:   number;
  goal:        string;
  errorType:   string;      // e.g. "build_fail", "runtime_crash", "verification_fail"
  errorDetail: string;
  fixAttempt?: string;
  resolved:    boolean;
}

// ── Bridge ────────────────────────────────────────────────────────────────────

class MemoryBridge {

  async loadContextForPlanning(input: MemoryContextInput): Promise<BridgeResult<string>> {
    const { runId, projectId, goal } = input;
    const t0     = Date.now();
    const phase  = input.phase ?? "planning";
    const spanId = recordSpanStart(runId, "memory.load", {
      projectId: String(projectId),
      phase,
    });

    try {
      const manager = MemoryManager.for(projectId);

      // FIXED: Use semantically enhanced context (file + vector pipeline)
      const ctx = await manager.loadContext({ runId, goal });

      // Also inject retrieved memories from the pipeline
      const injection = await injectMemoryContext({ query: goal, projectId, runId, phase }).catch(() => null);
      const injectedChars = injection?.totalChars ?? 0;

      emitAgentCoordination({
        runId, projectId,
        agentName: "memory",
        role:      "context-provider",
        outcome:   "success",
        phase:     "plan",
      });

      if (injectedChars > 0) {
        memoryTelemetry.injected({
          runId, projectId,
          blockCount: injection?.blockCount ?? 0,
          totalChars: injectedChars,
          phase,
        });
      }

      incrementCounter("memory.context.loaded", { projectId: String(projectId) });
      recordSpanEnd(spanId, "ok");

      return {
        success:    true,
        data:       ctx ?? "",
        durationMs: Date.now() - t0,
        retryable:  false,
      };
    } catch (err) {
      console.warn(`[memory-bridge] Could not load context: ${err}`);
      memoryTelemetry.failed({ operation: "loadContext", projectId, reason: String(err), runId });
      recordSpanEnd(spanId, "error");
      return { success: true, data: "", durationMs: Date.now() - t0, retryable: false };
    }
  }

  async saveRunSummary(input: ReflectionInput): Promise<BridgeResult<void>> {
    const { runId, projectId, goal, outcome, durationMs, score, notes, messages } = input;
    const t0 = Date.now();

    try {
      const manager = MemoryManager.for(projectId);

      await manager.saveRunSummary(runId, goal, {
        success:    outcome !== "failure",
        summary:    notes ?? outcome,
        stopReason: outcome,
        steps:      0,
        error:      outcome === "failure" ? notes : undefined,
      });

      // Feed failure into semantic pipeline
      if (outcome === "failure" && notes) {
        observe({
          content:   `Failed run: "${goal.slice(0, 120)}" — ${notes.slice(0, 400)}`,
          projectId,
          runId,
          hint:      { success: false },
        }).catch(() => {});
      }

      emitAgentCoordination({
        runId, projectId,
        agentName: "memory",
        role:      "memory-writer",
        outcome:   "success",
        phase:     "learn",
      });

      memoryTelemetry.updated({ entryId: runId, category: "run-summary", projectId, field: "outcome" });
      incrementCounter("memory.summary.saved", { projectId: String(projectId), outcome });
      return { success: true, durationMs: Date.now() - t0, retryable: false };
    } catch (err) {
      console.warn(`[memory-bridge] Could not save summary: ${err}`);
      memoryTelemetry.failed({ operation: "saveRunSummary", projectId, reason: String(err), runId });
      return { success: false, error: String(err), durationMs: Date.now() - t0, retryable: false };
    }
  }

  /** Dedicated failure memory storage — richer structured failure record. */
  async saveFailureMemory(input: FailureMemoryInput): Promise<void> {
    const { runId, projectId, goal, errorType, errorDetail, fixAttempt, resolved } = input;

    const content = [
      `Failure [${errorType}]: "${goal.slice(0, 120)}"`,
      `Error: ${errorDetail.slice(0, 400)}`,
      fixAttempt ? `Fix attempt: ${fixAttempt.slice(0, 300)}` : null,
      `Resolved: ${resolved ? "yes" : "no"}`,
    ].filter(Boolean).join("\n");

    await observe({
      content,
      projectId,
      runId,
      hint: { success: resolved, fromReflection: false },
    }).catch(() => {});
  }

  async loadContextForRecovery(input: MemoryContextInput): Promise<BridgeResult<string>> {
    return this.loadContextForPlanning({ ...input, phase: "recovery" });
  }

  async loadContextForVerification(input: MemoryContextInput): Promise<BridgeResult<string>> {
    return this.loadContextForPlanning({ ...input, phase: "verification" });
  }

  async trackTaskOutcome(opts: {
    runId:     string;
    projectId: number;
    goal:      string;
    success:   boolean;
  }): Promise<void> {
    try {
      const manager = MemoryManager.for(opts.projectId);
      await manager.trackTaskOutcome({
        runId:   opts.runId,
        goal:    opts.goal,
        success: opts.success,
        maxStepsReached: false,
      });
    } catch (err) {
      console.warn(`[memory-bridge] trackTaskOutcome failed: ${err}`);
    }
  }
}

export const memoryBridge = new MemoryBridge();
