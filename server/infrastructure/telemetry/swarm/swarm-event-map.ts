/**
 * swarm-event-map.ts
 *
 * Canonical event taxonomy for the Full Quantum Swarm Routing System.
 * Single responsibility: event name constants + payload type contracts.
 *
 * Consumers import event names from here — never hardcode strings.
 * SwarmTelemetryFabric emits all events listed here.
 *
 * Canonical event set (17 events):
 *   swarm.route.start / .complete
 *   DAG.node.start / .complete
 *   specialist.dispatch / .complete / .failed
 *   lock.acquire / .release
 *   merge.start / .complete
 *   verification.start / .complete
 *   orchestration.abort
 *   runtime.crashed
 *   recovery.start / .complete
 */

// ── Event name constants ──────────────────────────────────────────────────────

export const SWARM_EVENTS = {
  // Routing
  ROUTE_START:          "swarm.route.start",
  ROUTE_COMPLETE:       "swarm.route.complete",

  // DAG
  DAG_NODE_START:       "DAG.node.start",
  DAG_NODE_COMPLETE:    "DAG.node.complete",

  // Specialists
  SPECIALIST_DISPATCH:  "specialist.dispatch",
  SPECIALIST_COMPLETE:  "specialist.complete",
  SPECIALIST_FAILED:    "specialist.failed",

  // Locks
  LOCK_ACQUIRE:         "lock.acquire",
  LOCK_RELEASE:         "lock.release",

  // Merge
  MERGE_START:          "merge.start",
  MERGE_COMPLETE:       "merge.complete",

  // Verification
  VERIFICATION_START:   "verification.start",
  VERIFICATION_COMPLETE:"verification.complete",

  // Lifecycle
  ORCHESTRATION_ABORT:  "orchestration.abort",
  RUNTIME_CRASHED:      "runtime.crashed",
  RECOVERY_START:       "recovery.start",
  RECOVERY_COMPLETE:    "recovery.complete",
} as const;

export type SwarmEventName = typeof SWARM_EVENTS[keyof typeof SWARM_EVENTS];

// ── Payload type contracts ────────────────────────────────────────────────────

export interface RouteStartPayload {
  strategy:    string;
  domainCount: number;
  nodeCount:   number;
  waves:       number;
}

export interface RouteCompletePayload {
  strategy:    string;
  success:     boolean;
  durationMs:  number;
  patchCount:  number;
}

export interface DagNodeStartPayload {
  nodeId:     string;
  domain:     string;
  waveIndex:  number;
  workerType: string;
}

export interface DagNodeCompletePayload {
  nodeId:     string;
  domain:     string;
  success:    boolean;
  durationMs: number;
}

export interface SpecialistDispatchPayload {
  taskId:   string;
  domain:   string;
  priority: string;
  goal:     string;
}

export interface SpecialistCompletePayload {
  taskId:     string;
  domain:     string;
  success:    boolean;
  patches:    number;
  durationMs: number;
}

export interface SpecialistFailedPayload {
  taskId:    string;
  domain:    string;
  error:     string;
  retryable: boolean;
}

export interface LockAcquirePayload {
  filePath:  string;
  ownerId:   string;
  timeoutMs: number;
}

export interface LockReleasePayload {
  filePath:  string;
  ownerId:   string;
  heldMs:    number;
}

export interface MergeStartPayload {
  patchCount:    number;
  conflictCount: number;
}

export interface MergeCompletePayload {
  applied:    number;
  skipped:    number;
  consistent: boolean;
  durationMs: number;
}

export interface VerificationStartPayload {
  waves:     string[];
  skipStages?: string[];
}

export interface VerificationCompletePayload {
  ok:         boolean;
  durationMs: number;
  failedWave?: string;
}

export interface OrchestrationAbortPayload {
  reason:  string;
  phase:   string;
  runId:   string;
}

export interface RuntimeCrashedPayload {
  error:     string;
  processId?: number;
  phase:     string;
}

export interface RecoveryStartPayload {
  reason:     string;
  fromPhase:  string;
  strategy:   string;
}

export interface RecoveryCompletePayload {
  success:    boolean;
  durationMs: number;
  resumePhase?: string;
}
