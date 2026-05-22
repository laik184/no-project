/**
 * server/agents/core/tool-loop/execution/tool-group-builder.ts
 *
 * Orchestrates classification → conflict detection → batch construction.
 * Single entry point for the tool-loop to convert raw LLM tool calls into
 * ordered execution batches ready for parallel or serial dispatch.
 */

import { bus }                from "../../../../infrastructure/events/bus.ts";
import { classifyToolCalls }  from "../classifiers/tool-call-classifier.ts";
import { detectConflicts }    from "./tool-conflict-detector.ts";
import { buildBatches }       from "./execution-batch.ts";
import { emitConflictsDetected } from "../telemetry/tool-execution-telemetry.ts";
import type { ClassifiedCall, ExecutionBatch } from "../types/parallel-execution.types.ts";

export interface RawToolCall {
  callId: string;
  name:   string;
  args:   string;
}

export interface GroupBuildResult {
  batches:            ExecutionBatch[];
  classified:         ClassifiedCall[];
  conflictsDetected:  number;
  parallelBatchCount: number;
  serialBatchCount:   number;
}

// ── Public entry point ────────────────────────────────────────────────────────

export function buildToolGroups(calls: RawToolCall[], runId: string): GroupBuildResult {
  // 1. Classify every call
  const classified = classifyToolCalls(calls);

  // 2. Detect conflicts among mutation calls
  const serialCalls    = classified.filter((c) => c.executionClass !== "PARALLEL_SAFE");
  const conflictReport = detectConflicts(serialCalls);

  if (conflictReport.hasConflicts) {
    emitConflictsDetected(runId, "pre-batch", conflictReport.conflicts);
  }

  // 3. Build ordered batches
  const batches = buildBatches(classified);

  const parallelBatchCount = batches.filter((b) => b.mode === "parallel").length;
  const serialBatchCount   = batches.filter((b) => b.mode === "serial").length;

  // 4. Emit a summary thinking event so the UI shows the execution plan
  bus.emit("agent.event", {
    runId,
    eventType: "agent.thinking" as any,
    phase:     "tool-group-builder",
    ts:        Date.now(),
    payload:   {
      text: buildSummaryText(calls.length, batches, parallelBatchCount, serialBatchCount),
    },
  });

  return { batches, classified, conflictsDetected: conflictReport.conflicts.length, parallelBatchCount, serialBatchCount };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildSummaryText(
  total:              number,
  batches:            ExecutionBatch[],
  parallelBatchCount: number,
  serialBatchCount:   number,
): string {
  const batchDesc = batches
    .map((b) => `[${b.mode}:${b.calls.map((c) => c.name).join(",")}]`)
    .join(" → ");
  return (
    `Parallel execution plan: ${total} tool(s) → ` +
    `${parallelBatchCount} parallel batch(es) + ${serialBatchCount} serial batch(es). ` +
    batchDesc
  );
}
