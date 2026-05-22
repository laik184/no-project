/**
 * server/agents/core/tool-loop/types/parallel-execution.types.ts
 *
 * Canonical type definitions for the parallel tool execution system.
 * Single source of truth — imported by all parallel execution modules.
 */

import type { ToolCallOutput } from "../tool-call.executor.ts";

// ── Execution classification ──────────────────────────────────────────────────

export type ExecutionClass =
  | "PARALLEL_SAFE"       // pure reads — safe to run concurrently
  | "SERIAL_REQUIRED"     // mutations — must run sequentially
  | "EXCLUSIVE_RESOURCE"; // terminal / singleton — run last, isolated

export type LockType =
  | "FILE_LOCK"
  | "PROCESS_LOCK"
  | "RUNTIME_LOCK"
  | "PACKAGE_LOCK";

// ── Classified call ───────────────────────────────────────────────────────────

export interface ClassifiedCall {
  callId:         string;
  name:           string;
  args:           string;
  executionClass: ExecutionClass;
  resourceKeys:   string[];  // resources this call mutates (for conflict detection)
}

// ── Execution batch ───────────────────────────────────────────────────────────

export interface ExecutionBatch {
  batchId: string;
  mode:    "parallel" | "serial";
  calls:   ClassifiedCall[];
}

// ── Execution result ──────────────────────────────────────────────────────────

export interface ToolExecutionRecord {
  callId:     string;
  name:       string;
  output:     ToolCallOutput;
  durationMs: number;
  retryCount: number;
  timedOut:   boolean;
}

export interface BatchExecutionResult {
  batchId:    string;
  records:    ToolExecutionRecord[];
  allOk:      boolean;
  durationMs: number;
}

// ── Configuration ─────────────────────────────────────────────────────────────

export interface ParallelExecutionConfig {
  maxConcurrency:       number;
  defaultToolTimeoutMs: number;
  maxRetries:           number;
}

export const DEFAULT_PARALLEL_CONFIG: ParallelExecutionConfig = {
  maxConcurrency:       5,
  defaultToolTimeoutMs: 30_000,
  maxRetries:           1,
};
