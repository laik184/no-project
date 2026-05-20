/**
 * memory-bridge.ts
 *
 * Typed bridge between the orchestration engine and the memory/reflection systems.
 * Injects semantic context into planning, recovery, and verification prompts.
 */

import { MemoryManager }        from "../../agents/memory/index.ts";
import { emitAgentCoordination } from "../core/orchestration-events.ts";
import { recordSpanStart, recordSpanEnd } from "../telemetry/orchestration-trace.ts";
import { incrementCounter }     from "../telemetry/orchestration-metrics.ts";
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

// ── Bridge ────────────────────────────────────────────────────────────────────

class MemoryBridge {
  async loadContextForPlanning(input: MemoryContextInput): Promise<BridgeResult<string>> {
    const { runId, projectId } = input;
    const t0     = Date.now();
    const spanId = recordSpanStart(runId, "memory.load", {
      projectId: String(projectId),
      phase:     input.phase ?? "planning",
    });

    try {
      const manager = MemoryManager.for(projectId);
      const ctx     = await manager.loadContext();

      emitAgentCoordination({
        runId, projectId,
        agentName: "memory",
        role:      "context-provider",
        outcome:   "success",
        phase:     "plan",
      });

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
      recordSpanEnd(spanId, "error");
      return { success: true, data: "", durationMs: Date.now() - t0, retryable: false };
    }
  }

  async saveRunSummary(input: ReflectionInput): Promise<BridgeResult<void>> {
    const { runId, projectId, goal, outcome, durationMs, score, notes, messages } = input;
    const t0 = Date.now();

    try {
      const manager = MemoryManager.for(projectId);

      // Use the summarizeAndPersist method which is the actual save pathway
      await manager.saveRunSummary({
        runId,
        goal,
        steps:    [],
        messages: messages ?? [],
        result:   { success: outcome !== "failure", output: notes ?? "" },
      });

      emitAgentCoordination({
        runId, projectId,
        agentName: "memory",
        role:      "memory-writer",
        outcome:   "success",
        phase:     "learn",
      });

      incrementCounter("memory.summary.saved", { projectId: String(projectId), outcome });
      return { success: true, durationMs: Date.now() - t0, retryable: false };
    } catch (err) {
      console.warn(`[memory-bridge] Could not save summary: ${err}`);
      return { success: false, error: String(err), durationMs: Date.now() - t0, retryable: false };
    }
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
