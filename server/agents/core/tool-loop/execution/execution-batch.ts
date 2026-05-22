/**
 * server/agents/core/tool-loop/execution/execution-batch.ts
 *
 * Converts a flat list of classified calls into ordered execution batches.
 *
 * Batching strategy
 * ─────────────────
 *   • Consecutive PARALLEL_SAFE calls that share no resource keys → one parallel batch
 *   • Any SERIAL_REQUIRED call breaks the parallel run and gets its own serial batch
 *   • EXCLUSIVE_RESOURCE calls are always isolated at a serial tail batch
 *   • Conflicting PARALLEL_SAFE calls (same resource key) flush the current parallel
 *     buffer and start a new one after the conflict point
 *
 * This preserves the LLM's intended sequencing for mutating operations while
 * maximising throughput for pure read workloads.
 */

import { v4 as uuidv4 } from "uuid";
import type { ClassifiedCall, ExecutionBatch } from "../types/parallel-execution.types.ts";

export function buildBatches(calls: ClassifiedCall[]): ExecutionBatch[] {
  if (calls.length === 0) return [];

  const batches: ExecutionBatch[] = [];
  let parallelBuffer: ClassifiedCall[] = [];
  const bufferResourceKeys = new Set<string>();

  function flushParallelBuffer(): void {
    if (parallelBuffer.length === 0) return;
    batches.push({ batchId: uuidv4(), mode: "parallel", calls: [...parallelBuffer] });
    parallelBuffer = [];
    bufferResourceKeys.clear();
  }

  for (const call of calls) {
    // Terminal tools: isolate at the very end
    if (call.executionClass === "EXCLUSIVE_RESOURCE") {
      flushParallelBuffer();
      batches.push({ batchId: uuidv4(), mode: "serial", calls: [call] });
      continue;
    }

    // Serial mutations: each gets its own serial batch
    if (call.executionClass === "SERIAL_REQUIRED") {
      flushParallelBuffer();
      batches.push({ batchId: uuidv4(), mode: "serial", calls: [call] });
      continue;
    }

    // PARALLEL_SAFE: check for resource key conflicts within the current buffer
    const hasConflict = call.resourceKeys.some((k) => bufferResourceKeys.has(k));
    if (hasConflict) {
      // Flush current buffer before adding this call so they don't overlap
      flushParallelBuffer();
    }

    parallelBuffer.push(call);
    for (const k of call.resourceKeys) bufferResourceKeys.add(k);
  }

  flushParallelBuffer();
  return batches;
}
