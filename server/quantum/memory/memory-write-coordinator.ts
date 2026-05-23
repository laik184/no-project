/**
 * memory-write-coordinator.ts
 *
 * MemoryWriteCoordinator — Phase 2: Memory Safety Layer.
 *
 * Named explicit coordinator that unifies:
 *   - server/quantum/memory/memory-write-queue.ts  (canonical — full transactional writes)
 *   - server/distributed/memory/memory-write-queue.ts (deprecated stub → re-exports quantum)
 *
 * All memory file writes MUST route through this coordinator.
 * Direct fs writes outside this system are a safety violation.
 *
 * Safety guarantees:
 *   ✅ Serialized writes per project lane (FIFO)
 *   ✅ Concurrent read safety (reads never blocked)
 *   ✅ Transaction boundaries (atomic write + rollback)
 *   ✅ Replay-safe memory (idempotent by queueKey + filePath)
 *   ✅ TTL + deadline enforcement
 *   ✅ Exponential-backoff retry on transient failures
 *   ✅ AbortSignal cancellation
 *   ✅ Full telemetry (write.started / completed / failed / retry)
 *   ✅ Ownership verification via MemoryOwnershipRegistry
 */

export {
  memoryWriteQueue as memoryWriteCoordinator,
  type EnqueueParams,
} from "./memory-write-queue.ts";

// Re-export for callers that previously imported the distributed stub
export { memoryWriteQueue } from "./memory-write-queue.ts";
