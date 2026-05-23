/**
 * server/quantum/memory/index.ts
 *
 * Public barrel for the Memory Write Safety System.
 * All external consumers import from here — never from subsystem files directly.
 *
 * Architecture:
 *   ┌─ memoryWriteQueue (facade) ────────────────────────────────────────────┐
 *   │  deterministicWriteCoordinator → QueueLaneManager → executeQueueEntry  │
 *   │  → SafeWritePolicyEngine → MemoryOwnershipRegistry → executeTransaction │
 *   │  → MemoryTelemetryBridge                                                │
 *   └────────────────────────────────────────────────────────────────────────┘
 *
 *   ┌─ transactionalMemoryWriter ────────────────────────────────────────────┐
 *   │  ownership claim → enqueue → commit telemetry → revoke ownership        │
 *   └────────────────────────────────────────────────────────────────────────┘
 *
 *   ┌─ parallelWriteIsolationLayer ──────────────────────────────────────────┐
 *   │  isolates parallel DAG branch writes — prevents cross-lane pollution    │
 *   └────────────────────────────────────────────────────────────────────────┘
 */

// ── Primary write entry points ────────────────────────────────────────────────

/** The canonical facade — all simple callers route through this. */
export { memoryWriteQueue }               from "./memory-write-queue.ts";

/** Full transactional writer with ownership lifecycle. */
export { transactionalMemoryWriter }      from "./transactional-memory-writer.ts";

/** Parallel-safe isolated batch writer for multi-agent/DAG paths. */
export { parallelWriteIsolationLayer }    from "./parallel-write-isolation-layer.ts";

/** Top-level coordinator (internal — exposed for integration tests). */
export { deterministicWriteCoordinator } from "./deterministic-write-coordinator.ts";

// ── Safety subsystems ─────────────────────────────────────────────────────────

export { safeWritePolicyEngine }          from "./safe-write-policy-engine.ts";
export { memoryOwnershipRegistry }        from "./memory-ownership-registry.ts";
export { memoryTelemetryBridge }          from "./memory-telemetry-bridge.ts";
export { rollbackConsistencyValidator }   from "./rollback-consistency-validator.ts";
export { queueHealthMonitor }             from "./queue-health-monitor.ts";
export { queueBackpressureGuard }         from "./queue-backpressure.ts";

// ── Transaction (internal; exported for testing) ──────────────────────────────
export { executeTransaction }             from "./memory-transaction.ts";

// ── Validator ─────────────────────────────────────────────────────────────────
export { validateContent, computeChecksum, verifyChecksum } from "./memory-validator.ts";

// ── Recovery ──────────────────────────────────────────────────────────────────
export { recoverFile, recoverDirectory, cleanStaleBackups } from "./memory-recovery.ts";

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  QueueKey,
  MemoryFileType,
  WriteRequest,
  WriteResult,
  QueueStats,
  ValidationResult,
  TransactionState,
  RecoveryResult,
  RecoveryAction,
} from "./memory-types.ts";

export type { EnqueueParams }              from "./memory-write-queue.ts";
export type { TransactionalWriteParams }   from "./transactional-memory-writer.ts";
export type { IsolatedWriteRequest }       from "./parallel-write-isolation-layer.ts";
export type {
  BackpressureState,
  BackpressurePolicy,
  LaneHealth,
  QueueHealthSnapshot,
  PolicyDecision,
  OwnershipToken,
  OwnershipClaim,
} from "./queue.types.ts";
