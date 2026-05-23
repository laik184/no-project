/**
 * server/distributed/memory/memory-write-queue.ts
 *
 * DEPRECATED — redirected to the canonical quantum implementation.
 *
 * This module was a lightweight promise-chain queue that only accepted
 * a `(projectId, fn)` signature.  It has been superseded by
 * `server/quantum/memory/memory-write-queue.ts` which adds:
 *   ✅ transactional writes (memory-transaction.ts)
 *   ✅ per-write timeout + deadline enforcement
 *   ✅ exponential-backoff retry
 *   ✅ AbortSignal cancellation
 *   ✅ checksum verification
 *   ✅ full telemetry (write.started / completed / failed / retry)
 *   ✅ isolated per-project FIFO lanes
 *
 * All callers should migrate to the quantum version.
 * This re-export keeps legacy imports compiling without changes.
 */

export { memoryWriteQueue } from "../../quantum/memory/memory-write-queue.ts";

// Re-export legacy types so existing callers don't need changes
export type { EnqueueParams } from "../../quantum/memory/memory-write-queue.ts";
