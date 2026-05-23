/**
 * event.types.ts — canonical payload interfaces for every bus event.
 *
 * Single source of truth for all event shapes.
 * Actual interfaces are split into domain sub-files; this file re-exports
 * everything and defines the BusEvents map (imported by bus.ts).
 *
 * No new local imports — sub-files carry the zero-circular guarantee.
 */

export type {
  AgentEvent, RunLifecycleEvent, ToolExecutionEvent,
  AgentDiffEvent, CheckpointEvent,
} from "./agent-event.types.ts";

export type {
  ConsoleLogEvent, FileChangeEvent, RuntimeVerifiedEvent,
  RuntimeObservationEvent, DebugLifecycleEvent, PreviewLifecycleEvent,
  RuntimePortEvent, RuntimeSyncEvent,
} from "./runtime-event.types.ts";

export type {
  QuantumScanEvent, MemoryWriteEvent, QuantumAggregationEvent,
} from "./quantum-event.types.ts";

import type { AgentEvent, RunLifecycleEvent, ToolExecutionEvent, AgentDiffEvent, CheckpointEvent }            from "./agent-event.types.ts";
import type { ConsoleLogEvent, FileChangeEvent, RuntimeVerifiedEvent, RuntimeObservationEvent, DebugLifecycleEvent, PreviewLifecycleEvent, RuntimePortEvent, RuntimeSyncEvent } from "./runtime-event.types.ts";
import type { QuantumScanEvent, MemoryWriteEvent }  from "./quantum-event.types.ts";

export type BusEvents = {
  "agent.event":              (event: AgentEvent) => void;
  "run.lifecycle":            (event: RunLifecycleEvent) => void;
  "console.log":              (event: ConsoleLogEvent) => void;
  "file.change":              (event: FileChangeEvent) => void;
  "runtime.verified":         (event: RuntimeVerifiedEvent) => void;
  "runtime.observation":      (event: RuntimeObservationEvent) => void;
  "runtime.sync":             (event: RuntimeSyncEvent) => void;
  "runtime.port":             (event: RuntimePortEvent) => void;
  "debug.lifecycle":          (event: DebugLifecycleEvent) => void;
  "tool.execution":           (event: ToolExecutionEvent) => void;
  "agent.diff":               (event: AgentDiffEvent) => void;
  "checkpoint.event":         (event: CheckpointEvent) => void;
  "preview.lifecycle":        (event: PreviewLifecycleEvent) => void;
  // ── Distributed File Scanner ───────────────────────────────────────────────
  "quantum.scan.started":     (event: QuantumScanEvent) => void;
  "quantum.scan.partitioned": (event: QuantumScanEvent) => void;
  "quantum.worker.started":   (event: QuantumScanEvent) => void;
  "quantum.worker.completed": (event: QuantumScanEvent) => void;
  "quantum.worker.failed":    (event: QuantumScanEvent) => void;
  "quantum.scan.completed":   (event: QuantumScanEvent) => void;
  "quantum.scan.failed":      (event: QuantumScanEvent) => void;
  // ── Memory Write Safety ────────────────────────────────────────────────────
  "memory.write.started":     (event: MemoryWriteEvent) => void;
  "memory.write.completed":   (event: MemoryWriteEvent) => void;
  "memory.write.failed":      (event: MemoryWriteEvent) => void;
  "memory.lock.wait":         (event: MemoryWriteEvent) => void;
  "memory.lock.acquired":     (event: MemoryWriteEvent) => void;
  "memory.lock.released":     (event: MemoryWriteEvent) => void;
  "memory.rollback":          (event: MemoryWriteEvent) => void;
  "memory.retry":             (event: MemoryWriteEvent) => void;
  "memory.recovery":          (event: MemoryWriteEvent) => void;
};
