/**
 * event.types.ts — canonical payload interfaces for every bus event.
 *
 * Single source of truth for all event shapes.
 * Imported by bus.ts, channel modules, and subscription-manager.
 * No local imports — zero risk of circular dependencies.
 */

export interface AgentEvent {
  runId:      string;
  projectId?: number;
  phase?:     string;
  agentName?: string;
  eventType:  string;
  payload?:   unknown;
  ts:         number;
}

export interface RunLifecycleEvent {
  runId:     string;
  projectId: number;
  status:    "started" | "completed" | "failed" | "cancelled";
  ts:        number;
}

export interface ConsoleLogEvent {
  projectId: number;
  stream:    "stdout" | "stderr";
  line:      string;
  ts:        number;
}

export interface FileChangeEvent {
  projectId: number;
  /** "writing" = AI tool has started writing (in-flight). "add"/"change"/"unlink" = completed. */
  type:      "add" | "change" | "unlink" | "writing";
  path:      string;
  /** Byte size of the content being written. Present only when type === "writing". */
  size?:     number;
  ts:        number;
}

export interface RuntimeVerifiedEvent {
  projectId: number;
  outcome:   string;
  port?:     number;
  summary:   string;
  analysis:  unknown;
  probe:     unknown;
  elapsedMs: number;
  ts:        number;
}

export interface RuntimeObservationEvent {
  projectId:    number;
  status:       string;
  errorCount:   number;
  recentErrors: string[];
  uptimeMs:     number;
  port?:        number;
  ts:           number;
}

export interface DebugLifecycleEvent {
  projectId: number;
  sessionId: string;
  eventType: string;
  payload:   unknown;
  ts:        number;
}

export interface ToolExecutionEvent {
  executionId:   string;
  runId:         string;
  projectId?:    number;
  toolName:      string;
  toolCategory?: string;
  stepIndex?:    number;
  phase:         "start" | "success" | "error";
  args?:         unknown;
  result?:       unknown;
  error?:        string;
  durationMs?:   number;
  timedOut?:     boolean;
  replaySafe?:   boolean;
  ts:            number;
}

export interface AgentDiffEvent {
  diffId:      number;
  sessionId:   string;
  projectId:   number;
  runId:       string;
  filePath:    string;
  isNewFile:   boolean;
  oldContent:  string;
  newContent:  string;
  unifiedDiff: string;
  status:      "pending" | "approved" | "rejected" | "expired";
  createdAt:   number;
  expiresAt:   number;
  ts?:         number;
}

export interface CheckpointEvent {
  eventType:      string;
  checkpointId?:  string;
  projectId:      number;
  runId?:         string;
  trigger?:       string;
  gitSha?:        string;
  restoredCount?: number;
  success?:       boolean;
  error?:         string;
  reason?:        string;
  ts:             number;
}

export interface PreviewLifecycleEvent {
  projectId: number;
  state:     string;
  prevState: string;
  message:   string;
  meta?:     Record<string, unknown>;
  ts:        number;
}

/**
 * Emitted by waitForPort() at every phase transition.
 * Carries structured port-readiness state for SSE fan-out and preview bridge.
 */
export interface RuntimePortEvent {
  /** Current phase of the port-wait FSM. */
  phase:       "waiting" | "ready" | "timeout" | "failed" | "cancelled";
  projectId:   number;
  runId?:      string;
  port:        number;
  ts:          number;
  /** Elapsed ms since waitForPort() was called — present on non-waiting phases. */
  elapsed?:    number;
  retryCount?: number;
  durationMs?: number;
  latencyMs?:  number;
  error?:      string;
  host?:       string;
  timeoutMs?:  number;
  lastError?:  string;
}

/**
 * Emitted by RuntimeStore on every validated phase transition.
 * Carries the full aggregated snapshot so consumers need no secondary lookup.
 * Intentionally mirrors RuntimeSyncEvent from runtime-types.ts — kept inline
 * here to preserve the zero-local-imports guarantee of this module.
 */
export interface RuntimeSyncEvent {
  projectId:  number;
  snapshot: {
    projectId:     number;
    phase:         string;
    message:       string;
    ts:            number;
    pid?:          number;
    port?:         number;
    command?:      string;
    startedAt?:    number;
    uptimeMs?:     number;
    restartCount?: number;
    processStatus?:string;
    lastActivity:  number;
    healthy:       boolean;
    crashReason?:  string;
    crashCount:    number;
    previewUrl?:   string;
  };
  transition: {
    from:    string;
    to:      string;
    message: string;
    ts:      number;
  };
}

// ── Quantum Scanner events ────────────────────────────────────────────────────

/**
 * Emitted by the Distributed File Scanner for all scan lifecycle phases.
 */
export interface QuantumScanEvent {
  /** UUID of the scan run. */
  scanId:          string;
  /** Project being scanned. */
  projectId:       number;
  /** What triggered the scan: "orchestration" | "dag" | "verification" | "recovery" | "manual". */
  trigger?:        string;
  /** Root path that was scanned. */
  rootPath?:       string;
  /** Total files discovered. */
  fileCount?:      number;
  /** Number of worker partitions created. */
  partitionCount?: number;
  /** Partition identifier (present on worker events). */
  partitionId?:    string;
  /** Zero-based worker index (present on worker events). */
  workerIndex?:    number;
  /** Wall-clock duration of the operation (ms). */
  durationMs?:     number;
  /** Total findings in the completed report. */
  findingCount?:   number;
  /** Error message on failure events. */
  error?:          string;
  /** Unix epoch ms. */
  ts:              number;
}

// ── Memory Write Safety events ────────────────────────────────────────────────

/**
 * Emitted by the Memory Write Safety System for all write lifecycle phases.
 * Covers queue entry, lock contention, commit, rollback, retry, and recovery.
 */
export interface MemoryWriteEvent {
  /** UUID of the originating WriteRequest. */
  requestId:   string;
  /** Absolute or project-relative file path being written. */
  filePath:    string;
  /** Logical owner name (e.g. "memory-store", "confidence-bridge"). */
  ownerId:     string;
  /** Active agent run id, or "system". */
  runId:       string;
  /** File format — present on write.started and write.completed. */
  fileType?:   string;
  /** Wall-clock duration since the request was enqueued. */
  durationMs?: number;
  /** Number of retry attempts consumed. */
  retries?:    number;
  /** SHA-256 truncated checksum of the committed content. */
  checksum?:   string;
  /** Lock id — present on lock.acquired and lock.released. */
  lockId?:     string;
  /** Error message — present on failed, rollback, and retry events. */
  error?:      string;
  /** Unix epoch ms. */
  ts:          number;
}

// ── Quantum Aggregation events ────────────────────────────────────────────────

/**
 * Emitted by the DAG-Wave Result Aggregation Layer.
 * Covers the full pipeline: collect → merge → validate → collapse.
 */
export interface QuantumAggregationEvent {
  /** Canonical run identifier. */
  runId:       string;
  projectId:   number;
  /** Zero-based wave index within the DAG run. */
  waveIndex:   number;
  /** Number of agent nodes in this wave. */
  nodeCount?:  number;
  /** Wall-clock duration of the aggregation pipeline (ms). */
  durationMs?: number;
  /** Conflict count — present on merge.conflict events. */
  conflictCount?: number;
  /** Kind of conflict — present on merge.conflict events. */
  conflictKind?: string;
  /** File path involved in a conflict or collapse. */
  filePath?:   string;
  /** Whether the collapsed state is safe to proceed with. */
  safe?:       boolean;
  /** Why the aggregation or collapse was blocked. */
  reason?:     string;
  /** Unix epoch ms. */
  ts:          number;
}

export type BusEvents = {
  "agent.event":           (event: AgentEvent) => void;
  "run.lifecycle":         (event: RunLifecycleEvent) => void;
  "console.log":           (event: ConsoleLogEvent) => void;
  "file.change":           (event: FileChangeEvent) => void;
  "runtime.verified":      (event: RuntimeVerifiedEvent) => void;
  "runtime.observation":   (event: RuntimeObservationEvent) => void;
  "runtime.sync":          (event: RuntimeSyncEvent) => void;
  "runtime.port":          (event: RuntimePortEvent) => void;
  "debug.lifecycle":       (event: DebugLifecycleEvent) => void;
  "tool.execution":        (event: ToolExecutionEvent) => void;
  "agent.diff":            (event: AgentDiffEvent) => void;
  "checkpoint.event":      (event: CheckpointEvent) => void;
  "preview.lifecycle":     (event: PreviewLifecycleEvent) => void;
  // ── Distributed File Scanner ─────────────────────────────────────────────
  "quantum.scan.started":     (event: QuantumScanEvent) => void;
  "quantum.scan.partitioned": (event: QuantumScanEvent) => void;
  "quantum.worker.started":   (event: QuantumScanEvent) => void;
  "quantum.worker.completed": (event: QuantumScanEvent) => void;
  "quantum.worker.failed":    (event: QuantumScanEvent) => void;
  "quantum.scan.completed":   (event: QuantumScanEvent) => void;
  "quantum.scan.failed":      (event: QuantumScanEvent) => void;
  // ── Memory Write Safety ──────────────────────────────────────────────────
  "memory.write.started":  (event: MemoryWriteEvent) => void;
  "memory.write.completed":(event: MemoryWriteEvent) => void;
  "memory.write.failed":   (event: MemoryWriteEvent) => void;
  "memory.lock.wait":      (event: MemoryWriteEvent) => void;
  "memory.lock.acquired":  (event: MemoryWriteEvent) => void;
  "memory.lock.released":  (event: MemoryWriteEvent) => void;
  "memory.rollback":       (event: MemoryWriteEvent) => void;
  "memory.retry":          (event: MemoryWriteEvent) => void;
  "memory.recovery":       (event: MemoryWriteEvent) => void;
};
