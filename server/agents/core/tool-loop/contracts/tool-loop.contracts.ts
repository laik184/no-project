/**
 * server/agents/core/tool-loop/contracts/tool-loop.contracts.ts
 *
 * Abstract interface contracts for the Tool-Loop parallel execution system.
 *
 * These interfaces enable testing, swapping, and extending the parallel/serial
 * execution strategies without modifying the tool-loop agent itself.
 * All concrete implementations must satisfy these contracts.
 */

import type {
  ClassifiedCall,
  BatchExecutionResult,
  ExecutionBatch,
  ExecutionClass,
} from "../types/parallel-execution.types.ts";
import type { ToolContext } from "../../../../tools/orchestrator.ts";

// ── Executor contracts ────────────────────────────────────────────────────────

/**
 * IParallelExecutor — runs PARALLEL_SAFE calls concurrently.
 * executeParallelBatch satisfies this interface.
 */
export interface IParallelExecutor {
  executeBatch(
    batchId:  string,
    calls:    ClassifiedCall[],
    ctx:      ToolContext,
    options?: { maxConcurrency?: number },
  ): Promise<BatchExecutionResult>;
}

/**
 * ISerialExecutor — runs SERIAL_REQUIRED / EXCLUSIVE_RESOURCE calls in order.
 * executeSerialBatch satisfies this interface.
 */
export interface ISerialExecutor {
  executeBatch(
    batchId: string,
    calls:   ClassifiedCall[],
    ctx:     ToolContext,
  ): Promise<BatchExecutionResult>;
}

// ── Classifier contracts ──────────────────────────────────────────────────────

/**
 * IToolClassifier — assigns an ExecutionClass to each tool call.
 */
export interface IToolClassifier {
  classify(toolName: string, args: string): ExecutionClass;
}

// ── Group builder contracts ───────────────────────────────────────────────────

export interface GroupBuilderResult {
  batches:        ExecutionBatch[];
  parallelCount:  number;
  serialCount:    number;
  exclusiveCount: number;
}

/**
 * IToolGroupBuilder — classifies calls and groups them into ordered batches.
 * buildToolGroups satisfies this interface.
 */
export interface IToolGroupBuilder {
  buildGroups(
    rawCalls: Array<{ callId: string; name: string; args: string }>,
    runId:    string,
  ): GroupBuilderResult;
}

// ── Conflict detector contracts ───────────────────────────────────────────────

/**
 * IConflictDetector — identifies write conflicts between parallel calls.
 */
export interface IConflictDetector {
  /** Returns the set of resource keys that would conflict if run in parallel. */
  detectConflicts(calls: ClassifiedCall[]): Set<string>;
}

// ── Timeout manager contracts ─────────────────────────────────────────────────

export interface TimeoutResult<T> {
  timedOut:   boolean;
  result:     T;
  timeoutMs:  number;
}

/**
 * IToolTimeoutManager — wraps a promise with per-tool timeout enforcement.
 */
export interface IToolTimeoutManager {
  withTimeout<T>(
    promise:  Promise<T>,
    toolName: string,
    callId:   string,
  ): Promise<TimeoutResult<T>>;
}

// ── Telemetry contracts ───────────────────────────────────────────────────────

export interface IToolLoopTelemetry {
  onBatchStarted(runId: string, batchId: string, mode: "parallel" | "serial", toolNames: string[]): void;
  onBatchCompleted(runId: string, result: BatchExecutionResult): void;
  onBatchFailed(runId: string, batchId: string, error: string): void;
  onToolStarted(runId: string, callId: string, name: string, batchId: string): void;
  onToolCompleted(runId: string, record: { callId: string; name: string; durationMs: number }, batchId: string): void;
  onToolFailed(runId: string, callId: string, name: string, error: string, batchId: string): void;
  onToolTimeout(runId: string, callId: string, name: string, timeoutMs: number): void;
}
