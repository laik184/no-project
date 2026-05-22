/**
 * Responsibility: Per-memory-key locking to prevent concurrent reads/writes from
 *                 producing inconsistent memory state. Thin wrapper over distributed-lock.
 * Dependencies: distributed/locks/distributed-lock
 * Failure: lock acquisition failure → throws; caller must handle (fail-closed).
 * Telemetry: lock.acquired / lock.released emitted by distributed-lock internally.
 */

import { distributedLock } from "../locks/distributed-lock.ts";
import type { Lease }      from "../locks/lease-manager.ts";

// ── Config ────────────────────────────────────────────────────────────────────

const MEMORY_LOCK_PREFIX = "memory:";
const DEFAULT_LEASE_MS   = 10_000;
const DEFAULT_WAIT_MS    = 5_000;

// ── Lock ─────────────────────────────────────────────────────────────────────

class MemoryLock {
  /**
   * Acquire an exclusive lock on a memory key.
   * Key format: "project:{projectId}:{memoryKey}" — e.g. "project:42:context.md"
   */
  async withMemoryLock<T>(
    projectId: number,
    memoryKey: string,
    ownerId:   string,
    fn:        (lease: Lease) => Promise<T>,
  ): Promise<T> {
    const key = `${MEMORY_LOCK_PREFIX}project:${projectId}:${memoryKey}`;

    return distributedLock.withLock(
      key,
      {
        ownerId,
        leaseMs:    DEFAULT_LEASE_MS,
        waitMs:     DEFAULT_WAIT_MS,
        retryMs:    100,
        renewable:  false,
        autoRenewMs: 0,
      },
      fn,
    );
  }

  /** Non-blocking check: is this memory key currently locked? */
  isLocked(projectId: number, memoryKey: string): boolean {
    const { lockRegistry } = require("../locks/lock-registry.ts");
    return lockRegistry.isLocked(`${MEMORY_LOCK_PREFIX}project:${projectId}:${memoryKey}`);
  }
}

export const memoryLock = new MemoryLock();
