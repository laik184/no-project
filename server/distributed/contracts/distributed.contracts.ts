/**
 * server/distributed/contracts/distributed.contracts.ts
 *
 * Distributed-readiness abstract interfaces (Phase 8).
 *
 * These contracts define the shape of infrastructure components that are
 * currently implemented in-process but are designed to be replaced with
 * Redis / BullMQ / worker_threads / cluster equivalents without changing
 * the application code that consumes them.
 *
 * Migration path
 * ──────────────
 *   Current:     in-process implementations (CentralWorkerPool, memoryWriteQueue, etc.)
 *   Next step:   Redis-backed implementations satisfying these same interfaces
 *   Final state: multi-node cluster with shared Redis state
 *
 * All IDs, keys, and payloads are JSON-serializable for Redis compatibility.
 */

// ── Distributed execution IDs ─────────────────────────────────────────────────

/**
 * Globally unique execution identifier.
 * Format: {nodeId}:{processId}:{uuid}
 * Redis-safe: no special characters beyond colons and hyphens.
 */
export type DistributedExecutionId = string;

/**
 * Correlation ID that groups all tasks belonging to a single user request.
 * Spans across nodes, queues, and services.
 */
export type CorrelationId = string;

/**
 * Wave trace ID — unique per parallel execution wave within a run.
 * Format: {runId}:wave:{waveIndex}
 */
export type WaveTraceId = string;

/**
 * Worker trace ID — unique per worker task execution.
 * Format: {runId}:worker:{taskId}:{attempt}
 */
export type WorkerTraceId = string;

// ── Distributed queue interface ───────────────────────────────────────────────

/**
 * IDistributedQueue — Redis/BullMQ-adaptable task queue.
 * Currently satisfied by the in-process PriorityQueue.
 */
export interface IDistributedQueue<T> {
  /** Enqueue a job. Returns the job ID. */
  enqueue(job: IDistributedJob<T>): Promise<string>;

  /** Dequeue the highest-priority job ready for execution. */
  dequeue(): Promise<IDistributedJob<T> | null>;

  /** Remove a specific job by ID. Returns true if removed. */
  remove(jobId: string): Promise<boolean>;

  /** Current queue depth. */
  size(): Promise<number>;

  /** All jobs currently in the queue (for inspection). */
  list(): Promise<IDistributedJob<T>[]>;
}

export interface IDistributedJob<T> {
  readonly id:          string;
  readonly correlationId: CorrelationId;
  readonly priority:    number;        // lower = higher urgency
  readonly payload:     T;
  readonly enqueuedAt:  number;        // Unix ms
  readonly expiresAt?:  number;        // Unix ms — job is dropped after this
  readonly attempts:    number;
  readonly maxAttempts: number;
}

// ── Distributed lock interface ────────────────────────────────────────────────

/**
 * IDistributedLock — Redis SET NX PX-adaptable lock.
 * Currently satisfied by FileLockManager.
 */
export interface IDistributedLock {
  /**
   * Acquire an exclusive lock on `resource`.
   * Returns the lock token on success, null if the resource is already locked.
   */
  acquire(resource: string, ownerId: string, ttlMs: number): Promise<string | null>;

  /**
   * Release a lock. Must present the token returned by acquire().
   * Fails silently if the token is stale or the lock has expired.
   */
  release(resource: string, ownerId: string, token: string): Promise<boolean>;

  /**
   * Extend TTL of a held lock without releasing it.
   */
  extend(resource: string, ownerId: string, token: string, additionalMs: number): Promise<boolean>;

  /**
   * Check whether a resource is currently locked (any owner).
   */
  isLocked(resource: string): Promise<boolean>;
}

// ── Distributed telemetry interface ──────────────────────────────────────────

/**
 * IDistributedTelemetry — wire-protocol-agnostic telemetry sink.
 * Currently satisfied by the EventBus (in-process).
 * Can be adapted to OpenTelemetry, Datadog, or custom collectors.
 */
export interface IDistributedTelemetry {
  /** Emit a single telemetry event. Fire-and-forget. */
  emit(event: IDistributedTelemetryEvent): void;

  /** Flush any buffered events. Returns when all events are persisted. */
  flush(): Promise<void>;
}

export interface IDistributedTelemetryEvent {
  /** Logical event name, e.g. "worker.completed" */
  readonly name:          string;
  /** Correlation ID linking all events in a user request. */
  readonly correlationId: CorrelationId;
  /** Execution ID of the specific task/worker that emitted this event. */
  readonly executionId:   DistributedExecutionId;
  /** Unix timestamp in milliseconds. */
  readonly ts:            number;
  /** Event-specific structured payload. Must be JSON-serializable. */
  readonly payload:       Record<string, unknown>;
  /** Severity level. */
  readonly level:         "debug" | "info" | "warn" | "error";
}

// ── Distributed state interface ───────────────────────────────────────────────

/**
 * IDistributedStateStore — Redis Hash-adaptable state store.
 * Currently satisfied by the in-memory runtime-store.
 */
export interface IDistributedStateStore<T> {
  get(key: string): Promise<T | null>;
  set(key: string, value: T, ttlMs?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
  keys(pattern: string): Promise<string[]>;
}

// ── Worker registration interface ─────────────────────────────────────────────

/**
 * IWorkerRegistry — maps worker IDs to their current state.
 * Enables multi-node coordination and dead-worker detection.
 */
export interface IWorkerRegistry {
  register(workerId: string, meta: IWorkerMeta): Promise<void>;
  heartbeat(workerId: string): Promise<void>;
  deregister(workerId: string): Promise<void>;
  list(): Promise<IWorkerMeta[]>;
  isAlive(workerId: string, maxAgeMs: number): Promise<boolean>;
}

export interface IWorkerMeta {
  readonly workerId:    string;
  readonly nodeId:      string;
  readonly processId:   number;
  readonly startedAt:   number;
  lastHeartbeat:        number;
  activeTasks:          number;
  status:               "idle" | "busy" | "draining" | "dead";
}
